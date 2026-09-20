import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Invite, User, Tenant } from '../db';
import { authMiddleware, AuthenticatedRequest } from '../auth';
import { checkPlanLimit } from '../billing';
import { generateAccessToken, generateRefreshToken } from '../jwt';
import { sendInviteEmail } from '../email';

export const invitesRouter = Router();

/**
 * GET /api/invites/validate/:token (Public)
 * Also accessible via GET /api/invites/:token
 * Validates invite token and returns preview details
 */
invitesRouter.get('/validate/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ error: 'Token de convite não fornecido' });
    }

    const invite = await Invite.findOne({
      where: { token },
      include: [
        { model: Tenant, attributes: ['id', 'name'] },
        { model: User, as: 'Inviter', attributes: ['id', 'name', 'email'] },
      ],
    });

    if (!invite) {
      return res.status(404).json({ error: 'Convite não encontrado ou link inválido' });
    }

    if (invite.status === 'accepted') {
      return res.status(400).json({ error: 'Este convite já foi aceito anteriormente' });
    }

    if (invite.status === 'canceled') {
      return res.status(400).json({ error: 'Este convite foi cancelado pelo administrador' });
    }

    const isExpired = new Date() > new Date(invite.expires_at);
    if (isExpired) {
      return res.status(400).json({ error: 'Este convite expirou. Solicite um novo envio ao administrador.' });
    }

    // Check if an account already exists with this email
    const existingUser = await User.findOne({ where: { email: invite.email.toLowerCase() } });

    return res.json({
      valid: true,
      email: invite.email,
      role: invite.role,
      tenant_id: invite.tenant_id,
      tenant_name: (invite as any).Tenant?.name || 'Workspace',
      inviter_name: (invite as any).Inviter?.name || 'Administrador',
      has_existing_account: !!existingUser,
      expires_at: invite.expires_at,
    });
  } catch (err: any) {
    console.error('Error validating invite token:', err);
    return res.status(500).json({ error: 'Erro ao validar convite' });
  }
});

/**
 * POST /api/invites/:token/accept (Public)
 * Accepts an invitation to join a workspace
 */
invitesRouter.post('/:token/accept', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { name, password } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token de convite obrigatório' });
    }

    const invite = await Invite.findOne({
      where: { token },
      include: [{ model: Tenant }],
    });

    if (!invite) {
      return res.status(404).json({ error: 'Convite não encontrado ou inválido' });
    }

    if (invite.status === 'accepted') {
      return res.status(400).json({ error: 'Este convite já foi aceito' });
    }

    if (invite.status === 'canceled') {
      return res.status(400).json({ error: 'Este convite foi revogado' });
    }

    if (new Date() > new Date(invite.expires_at)) {
      return res.status(400).json({ error: 'Este convite expirou' });
    }

    const tenant = (invite as any).Tenant || (await Tenant.findByPk(invite.tenant_id));
    if (!tenant) {
      return res.status(404).json({ error: 'Workspace de destino não encontrado' });
    }

    let user = await User.findOne({ where: { email: invite.email.toLowerCase() } });

    if (user) {
      // User exists: verify password
      if (!password) {
        return res.status(400).json({ error: 'Informe sua senha existente para confirmar a entrada no workspace' });
      }
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Senha incorreta para a conta existente' });
      }

      // Update user's workspace and role
      user.tenant_id = invite.tenant_id;
      user.role = invite.role || 'member';
      if (name && name.trim()) user.name = name.trim();
      await user.save();
    } else {
      // New user creation
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Nome é obrigatório para cadastro' });
      }
      if (!password || password.length < 6) {
        return res.status(400).json({ error: 'A senha deve conter no mínimo 6 caracteres' });
      }

      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);

      user = await User.create({
        tenant_id: invite.tenant_id,
        name: name.trim(),
        email: invite.email.toLowerCase().trim(),
        password_hash,
        default_hourly_rate: 150.0,
        role: invite.role || 'member',
      });
    }

    // Mark invite as accepted
    invite.status = 'accepted';
    await invite.save();

    // Issue tokens
    const accessToken = generateAccessToken(user.id, user.tenant_id);
    const refreshToken = await generateRefreshToken(user.id, user.tenant_id);

    // Set Cookies
    res.cookie('token', accessToken, {
      httpOnly: true,
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: false,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    });

    if (req.session) {
      req.session.userId = user.id;
      req.session.tenantId = user.tenant_id;
    }

    return res.json({
      message: 'Convite aceito com sucesso! Bem-vindo ao workspace.',
      token: accessToken,
      refreshToken,
      user: {
        id: user.id,
        tenant_id: user.tenant_id,
        name: user.name,
        email: user.email,
        role: user.role,
        default_hourly_rate: user.default_hourly_rate,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        plan_id: tenant.plan_id || 'free',
      },
    });
  } catch (err: any) {
    console.error('Error accepting invite:', err);
    return res.status(500).json({ error: 'Erro ao aceitar convite' });
  }
});

// --- PROTECTED ROUTES (Requires Authentication) ---

/**
 * GET /api/invites (Protected)
 * Lists all pending & historical invites and current team members for the tenant
 */
invitesRouter.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;

    const [invites, members] = await Promise.all([
      Invite.findAll({
        where: { tenant_id: tenantId },
        include: [
          { model: User, as: 'Inviter', attributes: ['id', 'name', 'email'] },
        ],
        order: [['created_at', 'DESC']],
      }),
      User.findAll({
        where: { tenant_id: tenantId },
        attributes: ['id', 'name', 'email', 'role', 'default_hourly_rate', 'created_at'],
        order: [['name', 'ASC']],
      }),
    ]);

    return res.json({
      invites,
      members,
    });
  } catch (err: any) {
    console.error('Error listing invites:', err);
    return res.status(500).json({ error: 'Erro ao listar convites' });
  }
});

/**
 * POST /api/invites (Protected)
 * Creates and sends a new invitation via email
 */
invitesRouter.post(
  '/',
  authMiddleware,
  checkPlanLimit('users'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { email, role } = req.body;
      const tenantId = req.tenantId!;
      const user = req.user!;
      const tenant = req.tenant!;

      if (tenant.plan_id !== 'team') {
        return res.status(403).json({
          error: 'O plano Pro é de uso estritamente individual e não aceita membros. Faça upgrade para o plano Team (R$ 9,90/usuário/mês) para convidar colaboradores para o seu workspace.',
          code: 'FEATURE_REQUIRES_TEAM_PLAN',
          upgrade_required: true,
        });
      }

      if (!email || !email.trim()) {
        return res.status(400).json({ error: 'Email do destinatário é obrigatório' });
      }

      const cleanEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        return res.status(400).json({ error: 'Endereço de email inválido' });
      }

      // Check if user is already in this tenant
      const existingInTenant = await User.findOne({
        where: { email: cleanEmail, tenant_id: tenantId },
      });
      if (existingInTenant) {
        return res.status(400).json({ error: 'Este usuário já faz parte deste workspace' });
      }

      // Check if there is already a pending invite
      let invite = await Invite.findOne({
        where: {
          tenant_id: tenantId,
          email: cleanEmail,
          status: 'pending',
        },
      });

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      if (invite) {
        // Refresh existing pending invite
        invite.token = token;
        invite.role = role || invite.role || 'member';
        invite.expires_at = expiresAt;
        invite.invited_by_user_id = user.id;
        await invite.save();
      } else {
        // Create new invite
        invite = await Invite.create({
          tenant_id: tenantId,
          email: cleanEmail,
          role: role || 'member',
          token,
          invited_by_user_id: user.id,
          status: 'pending',
          expires_at: expiresAt,
        });
      }

      // Determine Base URL
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
      const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
      const origin = req.headers.origin || (process.env.APP_URL ? process.env.APP_URL.replace(/\/$/, '') : `${proto}://${host}`);
      const inviteUrl = `${origin}/?invite=${token}`;

      // Dispatch Email
      const emailResult = await sendInviteEmail(
        cleanEmail,
        user.name,
        tenant.name,
        role || 'member',
        inviteUrl
      );

      return res.status(201).json({
        message: `Convite enviado com sucesso para ${cleanEmail}`,
        invite: {
          id: invite.id,
          email: invite.email,
          role: invite.role,
          status: invite.status,
          expires_at: invite.expires_at,
          created_at: invite.created_at,
        },
        preview_url: emailResult.previewUrl,
      });
    } catch (err: any) {
      console.error('Error creating invite:', err);
      return res.status(500).json({ error: 'Erro ao enviar convite' });
    }
  }
);

/**
 * DELETE /api/invites/:id (Protected)
 * Cancels a pending invite
 */
invitesRouter.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;

    const invite = await Invite.findOne({
      where: { id, tenant_id: tenantId },
    });

    if (!invite) {
      return res.status(404).json({ error: 'Convite não encontrado' });
    }

    if (invite.status !== 'pending') {
      return res.status(400).json({ error: 'Apenas convites pendentes podem ser cancelados' });
    }

    invite.status = 'canceled';
    await invite.save();

    return res.json({ message: 'Convite cancelado com sucesso' });
  } catch (err: any) {
    console.error('Error canceling invite:', err);
    return res.status(500).json({ error: 'Erro ao cancelar convite' });
  }
});
