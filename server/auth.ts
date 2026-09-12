import { Request, Response, NextFunction } from 'express';
import { User, Tenant } from './db';

// Extend Express Session
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    tenantId?: string;
  }
}

export interface AuthenticatedRequest extends Request {
  user?: User;
  tenant?: Tenant;
  tenantId?: string;
  userId?: string;
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    let userId = req.session?.userId;
    let tenantId = req.session?.tenantId;

    // Check custom headers if provided (e.g. API clients or switcher)
    if (!userId && req.headers['x-user-id']) {
      userId = req.headers['x-user-id'] as string;
    }

    // Default auto-login to first seeded user if session is empty (ensures instant zero-friction preview)
    if (!userId) {
      const defaultUser = await User.findOne();
      if (defaultUser) {
        userId = defaultUser.id;
        tenantId = defaultUser.tenant_id;
        if (req.session) {
          req.session.userId = userId;
          req.session.tenantId = tenantId;
        }
      }
    }

    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    const tenant = await Tenant.findByPk(tenantId || user.tenant_id);
    if (!tenant) {
      return res.status(401).json({ error: 'Tenant inválido' });
    }

    req.user = user;
    req.tenant = tenant;
    req.userId = user.id;
    req.tenantId = tenant.id;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Erro interno de autenticação' });
  }
}
