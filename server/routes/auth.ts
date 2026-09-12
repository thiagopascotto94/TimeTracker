import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User, Tenant } from '../db';
import { authMiddleware, AuthenticatedRequest } from '../auth';

export const authRouter = Router();

// POST /api/auth/login
authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    if (req.session) {
      req.session.userId = user.id;
      req.session.tenantId = user.tenant_id;
    }

    const tenant = await Tenant.findByPk(user.tenant_id);

    return res.json({
      user: {
        id: user.id,
        tenant_id: user.tenant_id,
        name: user.name,
        email: user.email,
        default_hourly_rate: user.default_hourly_rate,
      },
      tenant: tenant ? { id: tenant.id, name: tenant.name } : null,
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

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    const tenant = await Tenant.create({
      name: tenant_name || `Espaço de ${name.split(' ')[0]}`,
    });

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const user = await User.create({
      tenant_id: tenant.id,
      name,
      email,
      password_hash,
      default_hourly_rate: Number(default_hourly_rate) || 150.0,
    });

    if (req.session) {
      req.session.userId = user.id;
      req.session.tenantId = tenant.id;
    }

    res.status(201).json({
      user: {
        id: user.id,
        tenant_id: user.tenant_id,
        name: user.name,
        email: user.email,
        default_hourly_rate: user.default_hourly_rate,
      },
      tenant: { id: tenant.id, name: tenant.name },
    });
  } catch (err: any) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Erro ao cadastrar usuário' });
  }
});

// GET /api/auth/me
authRouter.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const tenant = req.tenant!;
    return res.json({
      user: {
        id: user.id,
        tenant_id: user.tenant_id,
        name: user.name,
        email: user.email,
        default_hourly_rate: user.default_hourly_rate,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
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
    const { name, default_hourly_rate, tenant_name } = req.body;

    if (name) user.name = name;
    if (default_hourly_rate !== undefined) {
      user.default_hourly_rate = Number(default_hourly_rate);
    }
    await user.save();

    if (tenant_name && req.tenant) {
      req.tenant.name = tenant_name;
      await req.tenant.save();
    }

    return res.json({
      user: {
        id: user.id,
        tenant_id: user.tenant_id,
        name: user.name,
        email: user.email,
        default_hourly_rate: user.default_hourly_rate,
      },
      tenant: req.tenant ? { id: req.tenant.id, name: req.tenant.name } : null,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao atualizar perfil' });
  }
});

// POST /api/auth/logout
authRouter.post('/logout', (req, res) => {
  if (req.session) {
    req.session.destroy(() => {
      res.json({ message: 'Sessão encerrada com sucesso' });
    });
  } else {
    res.json({ message: 'Sessão encerrada' });
  }
});
