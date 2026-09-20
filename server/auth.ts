import { Request, Response, NextFunction } from 'express';
import { User, Tenant, Workspace, WorkspaceMember } from './db';
import { verifyToken } from './jwt';
import { getTenantWorkspaceLockInfo } from './workspace-limits';

// Extend Express Session
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    tenantId?: string;
    workspaceId?: string;
  }
}

export interface AuthenticatedRequest extends Request {
  user?: User;
  tenant?: Tenant;
  tenantId?: string;
  userId?: string;
  workspace?: Workspace;
  workspaceId?: string;
  workspaceRole?: string;
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

    // Resolve Workspace Lock Info for Tenant
    const lockInfo = await getTenantWorkspaceLockInfo(tenant.id);

    // Resolve Workspace
    let requestedWorkspaceId =
      (req.headers['x-workspace-id'] as string) ||
      (req.query.workspace_id as string) ||
      req.session?.workspaceId;

    const lockedIds = Array.isArray(lockInfo?.lockedWorkspaceIds) ? lockInfo.lockedWorkspaceIds : [];
    // Check if the requested workspace is locked under the current plan
    if (requestedWorkspaceId && lockedIds.includes(requestedWorkspaceId)) {
      const requestPath = req.originalUrl || req.url || '';
      const isWorkspaceManagement = requestPath.startsWith('/api/workspaces/') && requestPath !== '/api/workspaces';
      const isWorkspaceDataRoute =
        requestPath.startsWith('/api/sessions') ||
        requestPath.startsWith('/api/clients') ||
        requestPath.startsWith('/api/reports') ||
        requestPath.startsWith('/api/ai') ||
        requestPath.startsWith('/api/git') ||
        isWorkspaceManagement;

      if (isWorkspaceDataRoute) {
        return res.status(403).json({
          error: 'Acesso bloqueado: Este workspace está bloqueado no plano Free. Apenas o primeiro workspace está liberado para acesso e qualquer tipo de edição.',
          code: 'WORKSPACE_LOCKED',
          is_locked: true,
          workspace_id: requestedWorkspaceId,
          plan_name: lockInfo?.planName || 'Free',
        });
      }

      // For non-scoped routes (like /api/workspaces list, /api/auth/*, /api/billing/*),
      // redirect requestedWorkspaceId to the first unlocked workspace so session stays valid
      requestedWorkspaceId = lockInfo?.firstUnlockedWorkspaceId || undefined;
    }

    let membership: WorkspaceMember | null = null;
    let workspace: Workspace | null = null;

    if (requestedWorkspaceId) {
      membership = await WorkspaceMember.findOne({
        where: { workspace_id: requestedWorkspaceId, user_id: user.id },
      });
      if (membership) {
        workspace = await Workspace.findByPk(requestedWorkspaceId);
      }
    }

    // If no valid or unlocked workspace found via header/query/session, pick the first unlocked workspace
    if (!workspace || lockedIds.includes(workspace.id)) {
      const firstUnlockedId = lockInfo?.firstUnlockedWorkspaceId;
      if (firstUnlockedId) {
        membership = await WorkspaceMember.findOne({
          where: { workspace_id: firstUnlockedId, user_id: user.id },
        });
        if (membership) {
          workspace = await Workspace.findByPk(firstUnlockedId);
        }
      }

      if (!workspace) {
        membership = await WorkspaceMember.findOne({
          where: { user_id: user.id },
          include: [{ model: Workspace, as: 'Workspace' }],
        });

        if (membership && membership.Workspace) {
          workspace = membership.Workspace;
        } else {
          // Fallback: create default workspace for tenant if none exists
          workspace = await Workspace.findOne({ where: { tenant_id: tenant.id } });
          if (!workspace) {
            workspace = await Workspace.create({
              tenant_id: tenant.id,
              name: `Workspace de ${tenant.name}`,
              description: 'Workspace padrão',
            });
          }
          membership = await WorkspaceMember.create({
            workspace_id: workspace.id,
            user_id: user.id,
            role: 'owner',
          });
        }
      }
    }

    if (workspace && membership) {
      req.workspace = workspace;
      req.workspaceId = workspace.id;
      req.workspaceRole = membership.role;
      if (req.session) {
        req.session.workspaceId = workspace.id;
      }
    }

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Erro interno de autenticação' });
  }
}

export function requireRole(...allowedRoles: string[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.workspaceId || !req.workspaceRole) {
      return res.status(403).json({ error: 'Workspace não selecionado ou sem permissão' });
    }
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [];
    if (!roles.includes(req.workspaceRole)) {
      return res.status(403).json({
        error: `Acesso negado. Esta ação requer o papel: ${roles.join(' ou ')}`,
      });
    }
    next();
  };
}
