import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Op } from 'sequelize';
import { User, Tenant, Subscription, PasswordReset, Client, ClientContact, Workspace, WorkspaceMember, TimeSession } from '../db';
import { authMiddleware, AuthenticatedRequest } from '../auth';
import {
  generateAccessToken,
  generateRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
  generateToken,
} from '../jwt';
import { sendPasswordResetEmail, emailLogs } from '../email';

export const authRouter = Router();

// POST /api/auth/login
authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const user = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const token = generateAccessToken(user.id, user.tenant_id);
    const refreshToken = await generateRefreshToken(user.id, user.tenant_id);

    // Set cookies
    res.cookie('token', token, {
      httpOnly: true,
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'lax',
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: false,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: 'lax',
    });

    if (req.session) {
      req.session.userId = user.id;
      req.session.tenantId = user.tenant_id;
    }

    const tenant = await Tenant.findByPk(user.tenant_id);
    const linkedClients = await getLinkedClientsForEmail(user.email);

    return res.json({
      token,
      refreshToken,
      user: {
        id: user.id,
        tenant_id: user.tenant_id,
        name: user.name,
        email: user.email,
        role: user.role || 'admin',
        default_hourly_rate: user.default_hourly_rate,
        timezone: user.timezone || tenant?.timezone || 'America/Sao_Paulo',
      },
      tenant: tenant ? {
        id: tenant.id,
        name: tenant.name,
        plan_id: tenant.plan_id || 'free',
        timezone: tenant.timezone || 'America/Sao_Paulo',
      } : null,
      has_linked_clients: linkedClients.length > 0,
      linked_clients_count: linkedClients.length,
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erro ao efetuar login' });
  }
});

// POST /api/auth/register (Create new tenant + user)
authRouter.post('/register', async (req, res) => {
  try {
    const { name, email, password, tenant_name, default_hourly_rate } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ where: { email: cleanEmail } });
    if (existing) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    const tenant = await Tenant.create({
      name: tenant_name || `Espaço de ${name.split(' ')[0]}`,
      plan_id: 'free',
    });

    const now = new Date();
    const oneYearAhead = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    await Subscription.create({
      tenant_id: tenant.id,
      plan_id: 'free',
      status: 'active',
      current_period_start: now,
      current_period_end: oneYearAhead,
      cancel_at_period_end: false,
      gateway: 'manual',
    });

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const user = await User.create({
      tenant_id: tenant.id,
      name: name.trim(),
      email: cleanEmail,
      password_hash,
      default_hourly_rate: Number(default_hourly_rate) || 150.0,
      role: 'admin',
    });

    const token = generateAccessToken(user.id, tenant.id);
    const refreshToken = await generateRefreshToken(user.id, tenant.id);

    res.cookie('token', token, {
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
      req.session.tenantId = tenant.id;
    }

    const linkedClients = await getLinkedClientsForEmail(cleanEmail);

    res.status(201).json({
      token,
      refreshToken,
      user: {
        id: user.id,
        tenant_id: user.tenant_id,
        name: user.name,
        email: user.email,
        role: user.role || 'admin',
        default_hourly_rate: user.default_hourly_rate,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        plan_id: tenant.plan_id || 'free',
        default_target_minutes: tenant.default_target_minutes,
        default_client_daily_target_minutes: tenant.default_client_daily_target_minutes,
        git_provider: tenant.git_provider || 'github',
        github_repo: tenant.github_repo,
        github_token: tenant.github_token,
        gitlab_url: tenant.gitlab_url || 'https://gitlab.com',
        gitlab_project: tenant.gitlab_project,
        gitlab_token: tenant.gitlab_token,
      },
      has_linked_clients: linkedClients.length > 0,
      linked_clients_count: linkedClients.length,
    });
  } catch (err: any) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Erro ao cadastrar usuário' });
  }
});

// POST /api/auth/refresh (Rotate refresh token & issue fresh access token)
authRouter.post('/refresh', async (req, res) => {
  try {
    const rawToken =
      req.body?.refreshToken ||
      req.cookies?.refreshToken ||
      req.headers['x-refresh-token'];

    if (!rawToken) {
      return res.status(401).json({ error: 'Refresh token não fornecido' });
    }

    const rotated = await rotateRefreshToken(rawToken as string);
    if (!rotated) {
      res.clearCookie('token');
      res.clearCookie('refreshToken');
      return res.status(401).json({ error: 'Refresh token inválido, expirado ou revogado' });
    }

    res.cookie('token', rotated.accessToken, {
      httpOnly: true,
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    });

    res.cookie('refreshToken', rotated.refreshToken, {
      httpOnly: true,
      secure: false,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    });

    if (req.session) {
      req.session.userId = rotated.userId;
      req.session.tenantId = rotated.tenantId;
    }

    const user = await User.findByPk(rotated.userId);
    const tenant = await Tenant.findByPk(rotated.tenantId);

    return res.json({
      token: rotated.accessToken,
      refreshToken: rotated.refreshToken,
      user: user
        ? {
            id: user.id,
            tenant_id: user.tenant_id,
            name: user.name,
            email: user.email,
            role: user.role || 'admin',
            default_hourly_rate: user.default_hourly_rate,
          }
        : null,
      tenant: tenant
        ? {
            id: tenant.id,
            name: tenant.name,
            plan_id: tenant.plan_id || 'free',
          }
        : null,
    });
  } catch (err: any) {
    console.error('Refresh error:', err);
    return res.status(500).json({ error: 'Erro ao renovar token' });
  }
});

// Alias for /api/auth/refresh-token
authRouter.post('/refresh-token', async (req, res) => {
  try {
    const rawToken =
      req.body?.refreshToken ||
      req.cookies?.refreshToken ||
      req.headers['x-refresh-token'];

    if (!rawToken) {
      return res.status(401).json({ error: 'Refresh token não fornecido' });
    }

    const rotated = await rotateRefreshToken(rawToken as string);
    if (!rotated) {
      res.clearCookie('token');
      res.clearCookie('refreshToken');
      return res.status(401).json({ error: 'Refresh token inválido, expirado ou revogado' });
    }

    res.cookie('token', rotated.accessToken, {
      httpOnly: true,
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    });

    res.cookie('refreshToken', rotated.refreshToken, {
      httpOnly: true,
      secure: false,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    });

    return res.json({
      token: rotated.accessToken,
      refreshToken: rotated.refreshToken,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao renovar token' });
  }
});

// POST /api/auth/forgot-password
authRouter.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email é obrigatório' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ where: { email: cleanEmail } });

    // Respond uniformly to prevent user enumeration
    if (!user) {
      return res.json({
        message: 'Se este email estiver cadastrado, as instruções para redefinir sua senha foram enviadas.',
      });
    }

    // Invalidate previous active reset tokens for this user
    await PasswordReset.update({ used: true }, { where: { user_id: user.id, used: false } });

    // Generate 32-byte secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await PasswordReset.create({
      user_id: user.id,
      token,
      expires_at: expiresAt,
      used: false,
    });

    // Determine application URL
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    const origin = req.headers.origin || (process.env.APP_URL ? process.env.APP_URL.replace(/\/$/, '') : `${proto}://${host}`);
    const resetUrl = `${origin}/?reset=${token}`;

    const emailResult = await sendPasswordResetEmail(user.email, user.name, resetUrl);

    return res.json({
      message: 'Instruções para redefinir a senha enviadas com sucesso!',
      preview_url: emailResult.previewUrl,
    });
  } catch (err: any) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ error: 'Erro ao processar recuperação de senha' });
  }
});

// POST /api/auth/reset-password
authRouter.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Token de recuperação é obrigatório' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres' });
    }

    const resetRecord = await PasswordReset.findOne({
      where: {
        token,
        used: false,
      },
    });

    if (!resetRecord) {
      return res.status(400).json({ error: 'Token de recuperação inválido ou já utilizado' });
    }

    if (new Date() > new Date(resetRecord.expires_at)) {
      await resetRecord.update({ used: true });
      return res.status(400).json({ error: 'Este link de recuperação expirou. Por favor, solicite um novo.' });
    }

    const user = await User.findByPk(resetRecord.user_id);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Hash new password and save
    const salt = await bcrypt.genSalt(10);
    user.password_hash = await bcrypt.hash(password, salt);
    await user.save();

    // Mark reset record as used
    await resetRecord.update({ used: true });

    // Revoke all existing refresh tokens for security
    await revokeAllUserRefreshTokens(user.id);

    return res.json({
      message: 'Senha alterada com sucesso! Você já pode entrar com sua nova senha.',
    });
  } catch (err: any) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Erro ao redefinir senha' });
  }
});

// GET /api/auth/email-preview-latest (Development inspection helper)
authRouter.get('/email-preview-latest', (req, res) => {
  const latest = emailLogs[0] || null;
  return res.json({ email: latest });
});

// GET /api/auth/me
authRouter.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const tenant = req.tenant!;
    const token = generateToken(user.id, tenant.id);

    return res.json({
      token,
      user: {
        id: user.id,
        tenant_id: user.tenant_id,
        name: user.name,
        email: user.email,
        role: user.role,
        can_view_billing: req.canViewBilling ?? (user.can_view_billing !== false),
        default_hourly_rate: user.default_hourly_rate,
        timezone: user.timezone || tenant.timezone || 'America/Sao_Paulo',
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        plan_id: tenant.plan_id || 'free',
        timezone: tenant.timezone || 'America/Sao_Paulo',
        default_target_minutes: tenant.default_target_minutes,
        default_client_daily_target_minutes: tenant.default_client_daily_target_minutes,
        git_provider: tenant.git_provider || 'github',
        github_repo: tenant.github_repo,
        github_token: tenant.github_token,
        gitlab_url: tenant.gitlab_url || 'https://gitlab.com',
        gitlab_project: tenant.gitlab_project,
        gitlab_token: tenant.gitlab_token,
        allowed_repositories: tenant.allowed_repositories,
        max_retroactive_minutes: tenant.max_retroactive_minutes !== undefined && tenant.max_retroactive_minutes !== null ? Number(tenant.max_retroactive_minutes) : 120,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao obter dados do usuário' });
  }
});

// PUT /api/auth/profile
authRouter.put('/profile', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const {
      name,
      default_hourly_rate,
      tenant_name,
      default_target_minutes,
      default_client_daily_target_minutes,
      max_retroactive_minutes,
      git_provider,
      github_repo,
      github_token,
      gitlab_url,
      gitlab_project,
      gitlab_token,
      allowed_repositories,
      timezone,
    } = req.body;

    if (name) user.name = name;
    if (default_hourly_rate !== undefined) {
      user.default_hourly_rate = Number(default_hourly_rate);
    }
    if (timezone !== undefined) {
      user.timezone = typeof timezone === 'string' && timezone.trim() ? timezone.trim() : 'America/Sao_Paulo';
    }
    await user.save();

    if (req.tenant) {
      if (tenant_name !== undefined) req.tenant.name = tenant_name;
      if (timezone !== undefined) {
        req.tenant.timezone = typeof timezone === 'string' && timezone.trim() ? timezone.trim() : 'America/Sao_Paulo';
      }
      if (max_retroactive_minutes !== undefined) {
        req.tenant.max_retroactive_minutes = max_retroactive_minutes !== null && max_retroactive_minutes !== ''
          ? Math.max(0, Number(max_retroactive_minutes))
          : 120;
      }
      if (default_target_minutes !== undefined) {
        req.tenant.default_target_minutes = default_target_minutes !== null && default_target_minutes !== ''
          ? Number(default_target_minutes)
          : null;
      }
      if (default_client_daily_target_minutes !== undefined) {
        req.tenant.default_client_daily_target_minutes = default_client_daily_target_minutes !== null && default_client_daily_target_minutes !== ''
          ? Number(default_client_daily_target_minutes)
          : null;
      }
      if (git_provider !== undefined) {
        req.tenant.git_provider = git_provider === 'gitlab' ? 'gitlab' : 'github';
      }
      if (github_repo !== undefined) {
        req.tenant.github_repo = typeof github_repo === 'string' ? github_repo.trim() || null : null;
      }
      if (github_token !== undefined) {
        req.tenant.github_token = typeof github_token === 'string' ? github_token.trim() || null : null;
      }
      if (gitlab_url !== undefined) {
        req.tenant.gitlab_url = typeof gitlab_url === 'string' ? gitlab_url.trim() || 'https://gitlab.com' : 'https://gitlab.com';
      }
      if (gitlab_project !== undefined) {
        req.tenant.gitlab_project = typeof gitlab_project === 'string' ? gitlab_project.trim() || null : null;
      }
      if (gitlab_token !== undefined) {
        req.tenant.gitlab_token = typeof gitlab_token === 'string' ? gitlab_token.trim() || null : null;
      }
      if (allowed_repositories !== undefined) {
        req.tenant.allowed_repositories = typeof allowed_repositories === 'string'
          ? allowed_repositories
          : JSON.stringify(allowed_repositories || []);
      }
      await req.tenant.save();

      // If active workspace exists, sync max_retroactive_minutes
      if (req.workspaceId && max_retroactive_minutes !== undefined) {
        const { Workspace } = await import('../db');
        const activeWs = await Workspace.findByPk(req.workspaceId);
        if (activeWs) {
          activeWs.max_retroactive_minutes = req.tenant.max_retroactive_minutes;
          await activeWs.save();
        }
      }
    }

    return res.json({
      user: {
        id: user.id,
        tenant_id: user.tenant_id,
        name: user.name,
        email: user.email,
        default_hourly_rate: user.default_hourly_rate,
        timezone: user.timezone || req.tenant?.timezone || 'America/Sao_Paulo',
      },
      tenant: req.tenant ? {
        id: req.tenant.id,
        name: req.tenant.name,
        timezone: req.tenant.timezone || 'America/Sao_Paulo',
        default_target_minutes: req.tenant.default_target_minutes,
        default_client_daily_target_minutes: req.tenant.default_client_daily_target_minutes,
        max_retroactive_minutes: req.tenant.max_retroactive_minutes !== undefined && req.tenant.max_retroactive_minutes !== null ? Number(req.tenant.max_retroactive_minutes) : 120,
        git_provider: req.tenant.git_provider || 'github',
        github_repo: req.tenant.github_repo,
        github_token: req.tenant.github_token,
        gitlab_url: req.tenant.gitlab_url || 'https://gitlab.com',
        gitlab_project: req.tenant.gitlab_project,
        gitlab_token: req.tenant.gitlab_token,
        allowed_repositories: req.tenant.allowed_repositories,
      } : null,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao atualizar perfil' });
  }
});

// POST /api/auth/logout
authRouter.post('/logout', async (req, res) => {
  try {
    const rawRefreshToken =
      req.body?.refreshToken ||
      req.cookies?.refreshToken ||
      req.headers['x-refresh-token'];

    if (rawRefreshToken) {
      await revokeRefreshToken(rawRefreshToken as string);
    }
  } catch (e) {
    // Ignore error
  }

  res.clearCookie('token');
  res.clearCookie('refreshToken');
  if (req.session) {
    req.session.destroy(() => {
      res.json({ message: 'Sessão encerrada com sucesso' });
    });
  } else {
    res.json({ message: 'Sessão encerrada' });
  }
});

/**
 * Helper to fetch all clients linked to a given email across all workspaces.
 */
export async function getLinkedClientsForEmail(email: string) {
  const cleanEmail = (email || '').toLowerCase().trim();
  if (!cleanEmail) return [];

  // 1. Direct clients where email matches
  const directClients = await Client.findAll({
    where: {
      email: { [Op.like]: cleanEmail },
    },
  });

  // 2. Client contacts where email matches
  const matchedContacts = await ClientContact.findAll({
    where: {
      email: { [Op.like]: cleanEmail },
    },
    include: [{ model: Client, as: 'Client' }],
  });

  const linksMap = new Map<string, any>();

  for (const client of directClients) {
    const key = `client-${client.id}`;
    linksMap.set(key, {
      id: key,
      client,
      matched_as: 'client' as const,
      contact: null,
    });
  }

  for (const contact of matchedContacts) {
    if (contact.Client) {
      const key = `contact-${contact.id}`;
      linksMap.set(key, {
        id: key,
        client: contact.Client,
        matched_as: 'contact' as const,
        contact: {
          id: contact.id,
          name: contact.name,
          email: contact.email,
          role: contact.role,
          phone: contact.phone,
        },
      });
    }
  }

  const results = [];

  for (const item of Array.from(linksMap.values())) {
    const client = item.client;

    // Resolve workspace
    let workspace: Workspace | null = null;
    if (client.workspace_id) {
      workspace = await Workspace.findByPk(client.workspace_id);
    }
    if (!workspace) {
      workspace = await Workspace.findOne({ where: { tenant_id: client.tenant_id } });
    }

    // Resolve tenant
    const tenant = await Tenant.findByPk(client.tenant_id);

    // Resolve workspace owner
    let ownerMember: WorkspaceMember | null = null;
    if (workspace) {
      ownerMember = await WorkspaceMember.findOne({
        where: { workspace_id: workspace.id, role: 'owner' },
        include: [{ model: User, as: 'User' }],
      });

      if (!ownerMember || !(ownerMember as any).User) {
        ownerMember = await WorkspaceMember.findOne({
          where: { workspace_id: workspace.id, role: 'admin' },
          include: [{ model: User, as: 'User' }],
        });
      }
    }

    let ownerUser: User | null = (ownerMember as any)?.User || null;
    if (!ownerUser) {
      ownerUser = await User.findOne({
        where: { tenant_id: client.tenant_id, role: 'admin' },
      });
    }
    if (!ownerUser) {
      ownerUser = await User.findOne({
        where: { tenant_id: client.tenant_id },
        order: [['created_at', 'ASC']],
      });
    }

    // Sessions stats for this client
    const allSessions = await TimeSession.findAll({
      where: { client_id: client.id },
      order: [['start_time', 'DESC']],
    });

    let totalSeconds = 0;
    for (const s of allSessions) {
      if (s.start_time && s.end_time) {
        const diff = Math.floor((new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 1000);
        if (diff > 0) totalSeconds += diff;
      }
    }

    const hoursInt = Math.floor(totalSeconds / 3600);
    const minsInt = Math.floor((totalSeconds % 3600) / 60);
    const total_hours_formatted = hoursInt > 0 ? `${hoursInt}h ${minsInt}m` : `${minsInt}m`;

    const recent_sessions = allSessions.slice(0, 10).map((s) => {
      let durSec = 0;
      if (s.start_time && s.end_time) {
        durSec = Math.max(0, Math.floor((new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 1000));
      }
      const h = Math.floor(durSec / 3600);
      const m = Math.floor((durSec % 3600) / 60);
      return {
        id: s.id,
        title: s.title || 'Sessão sem título',
        start_time: s.start_time ? new Date(s.start_time).toISOString() : '',
        end_time: s.end_time ? new Date(s.end_time).toISOString() : null,
        duration_seconds: durSec,
        duration_formatted: h > 0 ? `${h}h ${m}m` : `${m}m`,
      };
    });

    results.push({
      id: item.id,
      matched_as: item.matched_as,
      contact: item.contact,
      client: {
        id: client.id,
        name: client.name,
        company: client.company,
        email: client.email,
        notes: client.notes,
        created_at: client.created_at,
      },
      workspace: {
        id: workspace ? workspace.id : client.tenant_id,
        name: workspace ? workspace.name : (tenant ? tenant.name : 'Workspace Padrão'),
        description: workspace ? workspace.description : null,
      },
      tenant: {
        id: tenant ? tenant.id : client.tenant_id,
        name: tenant ? tenant.name : 'Organização',
      },
      owner: {
        id: ownerUser ? ownerUser.id : '',
        name: ownerUser ? ownerUser.name : 'Administrador do Workspace',
        email: ownerUser ? ownerUser.email : '',
        role: ownerMember?.role === 'owner' ? 'Proprietário' : (ownerUser?.role === 'admin' ? 'Administrador' : 'Gestor'),
      },
      stats: {
        total_sessions: allSessions.length,
        total_seconds: totalSeconds,
        total_hours_formatted,
        recent_sessions,
      },
    });
  }

  return results;
}

// GET /api/auth/linked-clients
authRouter.get('/linked-clients', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const results = await getLinkedClientsForEmail(user.email);

    return res.json({
      user_email: user.email,
      linked_clients_count: results.length,
      linked_clients: results,
    });
  } catch (err: any) {
    console.error('Error fetching linked clients:', err);
    return res.status(500).json({ error: 'Erro ao buscar vínculos de clientes' });
  }
});
