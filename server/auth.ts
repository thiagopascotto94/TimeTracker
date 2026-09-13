import { Request, Response, NextFunction } from 'express';
import { User, Tenant } from './db';
import { verifyToken } from './jwt';

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
    let userId: string | undefined;
    let tenantId: string | undefined;

    // 1. Check Authorization header (Bearer token)
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);
      if (decoded) {
        userId = decoded.userId;
        tenantId = decoded.tenantId;
      }
    }

    // 2. Check cookie token
    if (!userId && req.cookies && req.cookies.token) {
      const decoded = verifyToken(req.cookies.token);
      if (decoded) {
        userId = decoded.userId;
        tenantId = decoded.tenantId;
      }
    }

    // 3. Check session fallback
    if (!userId && req.session) {
      userId = req.session.userId;
      tenantId = req.session.tenantId;
    }

    // 4. Check custom x-user-id header
    if (!userId && req.headers['x-user-id']) {
      userId = req.headers['x-user-id'] as string;
    }

    if (!userId) {
      return res.status(401).json({ error: 'Sessão expirada ou não autenticada' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    const tenant = await Tenant.findByPk(tenantId || user.tenant_id);
    if (!tenant) {
      return res.status(401).json({ error: 'Organização (Tenant) inválida' });
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
