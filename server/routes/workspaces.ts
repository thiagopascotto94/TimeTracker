import { Router, Response } from 'express';
import { Workspace, WorkspaceMember, User, Subscription, Plan, Tenant, Client, ClientContact, TimeSession, Task, SharedReport, Invoice } from '../db';
import { authMiddleware, requireRole, AuthenticatedRequest } from '../auth';
import { getTenantWorkspaceLockInfo, isWorkspaceLocked } from '../workspace-limits';
import { cacheGet, cacheSet, cacheDel } from '../cache';

export const workspacesRouter = Router();

workspacesRouter.use(authMiddleware);

// GET /api/workspaces - List workspaces of authenticated user
workspacesRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const tenantId = req.tenantId!;

    const cacheKey = `cronos:workspaces:${userId}:${tenantId}:${req.workspaceId || 'none'}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const [memberships, lockInfo] = await Promise.all([
      WorkspaceMember.findAll({
        where: { user_id: userId },
        include: [
          {
            model: Workspace,
            as: 'Workspace',
            where: { tenant_id: tenantId },
            include: [
              {
                model: WorkspaceMember,
                as: 'Members',
              },
            ],
          },
        ],
      }),
      getTenantWorkspaceLockInfo(tenantId),
    ]);

    // Sort workspaces chronologically (first created is index 0)
    const sortedMemberships = [...memberships].sort((a, b) => {
      const timeA = a.Workspace ? new Date(a.Workspace.created_at).getTime() : 0;
      const timeB = b.Workspace ? new Date(b.Workspace.created_at).getTime() : 0;
      return timeA - timeB;
    });

    // Check effective active workspace: if current active is locked, fallback to first unlocked
    let effectiveActiveId = req.workspaceId;
    const lockedIds = Array.isArray(lockInfo?.lockedWorkspaceIds) ? lockInfo.lockedWorkspaceIds : [];
    if (!effectiveActiveId || lockedIds.includes(effectiveActiveId)) {
      effectiveActiveId = lockInfo?.firstUnlockedWorkspaceId || sortedMemberships[0]?.Workspace?.id;
    }

    const workspaces = sortedMemberships.map((m, index) => {
      const ws = m.Workspace!;
      const membersCount = ws.Members ? ws.Members.length : 0;
      const lockData = lockInfo.workspaces.find((w) => w.id === ws.id);
      const isLocked = lockData ? lockData.is_locked : false;
      const lockReason = lockData ? lockData.lock_reason : null;

      return {
        id: ws.id,
        name: ws.name,
        description: ws.description,
        role: m.role,
        members_count: membersCount,
        created_at: ws.created_at,
        updated_at: ws.updated_at,
        order_index: index,
        is_locked: isLocked,
        lock_reason: lockReason,
        is_active: ws.id === effectiveActiveId,
      };
    });

    const planId = lockInfo.planId;
    const planName = lockInfo.planName;
    const maxWorkspaces = lockInfo.maxWorkspaces;
    const currentCount = workspaces.length;
    const canCreateMore = maxWorkspaces === -1 || currentCount < maxWorkspaces;

    const payload = {
      workspaces,
      activeWorkspaceId: effectiveActiveId,
      plan: {
        id: planId,
        name: planName,
        max_workspaces: maxWorkspaces,
      },
      usage: {
        workspaces_count: currentCount,
        max_workspaces: maxWorkspaces,
        can_create: canCreateMore,
        locked_count: lockInfo.lockedWorkspaceIds.length,
        unlocked_count: lockInfo.unlockedWorkspaceIds.length,
      },
    };

    await cacheSet(cacheKey, payload, 30);
    return res.json(payload);
  } catch (error) {
    console.error('Error listing workspaces:', error);
    res.status(500).json({ error: 'Erro ao listar workspaces' });
  }
});

// POST /api/workspaces - Create new workspace
workspacesRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nome do workspace é obrigatório' });
    }

    // Check plan limit for workspaces
    const sub = await Subscription.findOne({
      where: { tenant_id: tenantId, status: 'active' },
      include: [{ model: Plan, as: 'Plan' }],
    });
    const maxWorkspaces = sub?.Plan?.max_workspaces ?? 1;

    const currentCount = await Workspace.count({ where: { tenant_id: tenantId } });
    if (maxWorkspaces !== -1 && currentCount >= maxWorkspaces) {
      return res.status(403).json({
        error: `O plano Free permite apenas 1 workspace. Faça upgrade para o plano Pro para criar múltiplos workspaces.`,
        plan_limit_exceeded: true,
      });
    }

    const workspace = await Workspace.create({
      tenant_id: tenantId,
      name: name.trim(),
      description: description ? description.trim() : null,
    });

    await WorkspaceMember.create({
      workspace_id: workspace.id,
      user_id: userId,
      role: 'owner',
    });

    await cacheDel('cronos:workspaces:*');

    return res.status(201).json({
      workspace: {
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
        role: 'owner',
        members_count: 1,
        created_at: workspace.created_at,
      },
    });
  } catch (error) {
    console.error('Error creating workspace:', error);
    res.status(500).json({ error: 'Erro ao criar workspace' });
  }
});

// GET /api/workspaces/:id - Get workspace details & members
workspacesRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const membership = await WorkspaceMember.findOne({
      where: { workspace_id: id, user_id: userId },
    });
    if (!membership) {
      return res.status(403).json({ error: 'Acesso negado a este workspace' });
    }

    const [workspace, lockCheck] = await Promise.all([
      Workspace.findByPk(id, {
        include: [
          {
            model: WorkspaceMember,
            as: 'Members',
            include: [{ model: User, as: 'User', attributes: ['id', 'name', 'email', 'role'] }],
          },
        ],
      }),
      isWorkspaceLocked(id, req.tenantId!),
    ]);

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace não encontrado' });
    }

    return res.json({
      workspace: {
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
        is_locked: lockCheck.isLocked,
        lock_reason: lockCheck.reason,
        git_provider: workspace.git_provider || 'github',
        github_repo: workspace.github_repo,
        github_token: workspace.github_token,
        gitlab_url: workspace.gitlab_url || 'https://gitlab.com',
        gitlab_project: workspace.gitlab_project,
        gitlab_token: workspace.gitlab_token,
        allowed_repositories: workspace.allowed_repositories,
        default_target_minutes: workspace.default_target_minutes ?? 60,
        default_client_daily_target_minutes: workspace.default_client_daily_target_minutes ?? 120,
        monthly_billing_goal: workspace.monthly_billing_goal ?? 10000.0,
        role: membership.role,
        members: workspace.Members?.map((m) => ({
          id: m.id,
          user_id: m.user_id,
          role: m.role,
          user: m.User ? { id: m.User.id, name: m.User.name, email: m.User.email } : null,
          created_at: m.created_at,
        })),
        created_at: workspace.created_at,
      },
    });
  } catch (error) {
    console.error('Error getting workspace details:', error);
    res.status(500).json({ error: 'Erro ao buscar detalhes do workspace' });
  }
});

// PUT /api/workspaces/:id - Update workspace (owner/admin)
workspacesRouter.put('/:id', requireRole('owner', 'admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if workspace is locked under plan
    const lockCheck = await isWorkspaceLocked(id, req.tenantId!);
    if (lockCheck.isLocked) {
      return res.status(403).json({
        error: 'Este workspace está bloqueado no plano Free. Apenas o primeiro workspace está liberado para qualquer tipo de edição.',
        code: 'WORKSPACE_LOCKED',
        is_locked: true,
        reason: lockCheck.reason,
      });
    }

    const {
      name,
      description,
      default_target_minutes,
      default_client_daily_target_minutes,
      monthly_billing_goal,
      git_provider,
      github_repo,
      github_token,
      gitlab_url,
      gitlab_project,
      gitlab_token,
      allowed_repositories,
    } = req.body;

    const workspace = await Workspace.findByPk(id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace não encontrado' });
    }

    if (name !== undefined && name.trim()) {
      workspace.name = name.trim();
    }
    if (description !== undefined) {
      workspace.description = description ? description.trim() : null;
    }
    if (default_target_minutes !== undefined) {
      workspace.default_target_minutes = default_target_minutes !== null && default_target_minutes !== '' ? Number(default_target_minutes) : null;
    }
    if (default_client_daily_target_minutes !== undefined) {
      workspace.default_client_daily_target_minutes = default_client_daily_target_minutes !== null && default_client_daily_target_minutes !== '' ? Number(default_client_daily_target_minutes) : null;
    }
    if (monthly_billing_goal !== undefined) {
      workspace.monthly_billing_goal = monthly_billing_goal !== null && monthly_billing_goal !== '' ? Number(monthly_billing_goal) : null;
    }
    if (git_provider !== undefined) {
      workspace.git_provider = git_provider === 'gitlab' ? 'gitlab' : 'github';
    }
    if (github_repo !== undefined) {
      workspace.github_repo = typeof github_repo === 'string' ? github_repo.trim() || null : null;
    }
    if (github_token !== undefined) {
      workspace.github_token = typeof github_token === 'string' ? github_token.trim() || null : null;
    }
    if (gitlab_url !== undefined) {
      workspace.gitlab_url = typeof gitlab_url === 'string' ? gitlab_url.trim() || 'https://gitlab.com' : 'https://gitlab.com';
    }
    if (gitlab_project !== undefined) {
      workspace.gitlab_project = typeof gitlab_project === 'string' ? gitlab_project.trim() || null : null;
    }
    if (gitlab_token !== undefined) {
      workspace.gitlab_token = typeof gitlab_token === 'string' ? gitlab_token.trim() || null : null;
    }
    if (allowed_repositories !== undefined) {
      workspace.allowed_repositories = typeof allowed_repositories === 'string'
        ? allowed_repositories
        : JSON.stringify(allowed_repositories || []);
    }

    await workspace.save();

    return res.json({
      workspace: {
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
        git_provider: workspace.git_provider,
        github_repo: workspace.github_repo,
        github_token: workspace.github_token,
        gitlab_url: workspace.gitlab_url,
        gitlab_project: workspace.gitlab_project,
        gitlab_token: workspace.gitlab_token,
        allowed_repositories: workspace.allowed_repositories,
        default_target_minutes: workspace.default_target_minutes,
        default_client_daily_target_minutes: workspace.default_client_daily_target_minutes,
        monthly_billing_goal: workspace.monthly_billing_goal,
      },
      message: 'Workspace atualizado com sucesso',
    });
  } catch (error) {
    console.error('Error updating workspace:', error);
    res.status(500).json({ error: 'Erro ao atualizar workspace' });
  }
});

// DELETE /api/workspaces/:id - Delete workspace (owner only)
workspacesRouter.delete('/:id', requireRole('owner'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const lockCheck = await isWorkspaceLocked(id, req.tenantId!);
    if (lockCheck.isLocked) {
      return res.status(403).json({
        error: 'Este workspace está bloqueado no plano Free. Apenas o primeiro workspace está liberado para acesso e qualquer tipo de edição.',
        code: 'WORKSPACE_LOCKED',
        is_locked: true,
        reason: lockCheck.reason,
      });
    }

    const workspace = await Workspace.findByPk(id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace não encontrado' });
    }

    // Ensure at least one workspace remains for the tenant
    const count = await Workspace.count({ where: { tenant_id: workspace.tenant_id } });
    if (count <= 1) {
      return res.status(400).json({ error: 'Você não pode deletar o único workspace remanescente.' });
    }

    await WorkspaceMember.destroy({ where: { workspace_id: id } });
    await workspace.destroy();

    return res.json({ success: true, message: 'Workspace deletado com sucesso' });
  } catch (error) {
    console.error('Error deleting workspace:', error);
    res.status(500).json({ error: 'Erro ao deletar workspace' });
  }
});

// GET /api/workspaces/:id/members - List members
workspacesRouter.get('/:id/members', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const membership = await WorkspaceMember.findOne({
      where: { workspace_id: id, user_id: userId },
    });
    if (!membership) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const members = await WorkspaceMember.findAll({
      where: { workspace_id: id },
      include: [{ model: User, as: 'User', attributes: ['id', 'name', 'email', 'role'] }],
    });

    return res.json({
      members: members.map((m) => ({
        id: m.id,
        user_id: m.user_id,
        role: m.role,
        user: m.User ? { id: m.User.id, name: m.User.name, email: m.User.email } : null,
        created_at: m.created_at,
      })),
    });
  } catch (error) {
    console.error('Error listing members:', error);
    res.status(500).json({ error: 'Erro ao listar membros' });
  }
});

// POST /api/workspaces/:id/members - Add member (owner/admin)
workspacesRouter.post('/:id/members', requireRole('owner', 'admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const lockCheck = await isWorkspaceLocked(id, req.tenantId!);
    if (lockCheck.isLocked) {
      return res.status(403).json({
        error: 'Este workspace está bloqueado no plano Free. Apenas o primeiro workspace está liberado para qualquer tipo de edição.',
        code: 'WORKSPACE_LOCKED',
        is_locked: true,
        reason: lockCheck.reason,
      });
    }

    // Verify that the workspace is on the Team plan (Pro is individual and does not accept members)
    const tenant = await Tenant.findByPk(req.tenantId!, {
      include: [{ model: Plan, as: 'Plan' }],
    });
    const planId = tenant?.plan_id || tenant?.Plan?.id || 'free';
    if (planId !== 'team') {
      return res.status(403).json({
        error: 'O plano Pro é de uso estritamente individual e não aceita membros adicionais. Faça upgrade para o plano Team (cobrado por usuário) para adicionar colaboradores ao seu workspace.',
        code: 'FEATURE_REQUIRES_TEAM_PLAN',
        upgrade_required: true,
        plan: planId,
      });
    }

    const { email, role } = req.body;
    const currentRole = req.workspaceRole;

    if (!email) {
      return res.status(400).json({ error: 'E-mail do usuário é obrigatório' });
    }

    const targetUser = await User.findOne({ where: { email: email.trim().toLowerCase(), tenant_id: req.tenantId! } });
    if (!targetUser) {
      return res.status(404).json({ error: 'Usuário não encontrado na organização' });
    }

    const requestedRole = role || 'member';
    if (requestedRole === 'admin' && currentRole !== 'owner') {
      return res.status(403).json({ error: 'Apenas o proprietário (owner) pode adicionar administradores' });
    }

    // Check if already member
    const existing = await WorkspaceMember.findOne({ where: { workspace_id: id, user_id: targetUser.id } });
    if (existing) {
      return res.status(400).json({ error: 'Usuário já é membro deste workspace' });
    }

    const newMember = await WorkspaceMember.create({
      workspace_id: id,
      user_id: targetUser.id,
      role: requestedRole,
    });

    return res.status(201).json({
      member: {
        id: newMember.id,
        user_id: targetUser.id,
        role: newMember.role,
        user: { id: targetUser.id, name: targetUser.name, email: targetUser.email },
      },
      message: 'Membro adicionado com sucesso',
    });
  } catch (error) {
    console.error('Error adding member:', error);
    res.status(500).json({ error: 'Erro ao adicionar membro' });
  }
});

// DELETE /api/workspaces/:id/members/:userId - Remove member
workspacesRouter.delete('/:id/members/:targetUserId', requireRole('owner', 'admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id, targetUserId } = req.params;

    const lockCheck = await isWorkspaceLocked(id, req.tenantId!);
    if (lockCheck.isLocked) {
      return res.status(403).json({
        error: 'Este workspace está bloqueado no plano Free. Apenas o primeiro workspace está liberado para qualquer tipo de edição.',
        code: 'WORKSPACE_LOCKED',
        is_locked: true,
        reason: lockCheck.reason,
      });
    }

    const currentRole = req.workspaceRole;
    const currentUserId = req.userId!;

    const targetMembership = await WorkspaceMember.findOne({ where: { workspace_id: id, user_id: targetUserId } });
    if (!targetMembership) {
      return res.status(404).json({ error: 'Membro não encontrado no workspace' });
    }

    if (targetMembership.role === 'owner') {
      return res.status(403).json({ error: 'Não é possível remover o proprietário (owner) do workspace' });
    }

    if (currentRole === 'admin' && targetMembership.role === 'admin') {
      return res.status(403).json({ error: 'Administradores não podem remover outros administradores' });
    }

    await targetMembership.destroy();

    return res.json({ success: true, message: 'Membro removido com sucesso' });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ error: 'Erro ao remover membro' });
  }
});

/**
 * GET /api/workspaces/:id/export - Export full workspace data
 * Exclusively available for Pro and Team plans
 */
workspacesRouter.get('/:id/export', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    // 1. Verify plan restriction (Pro and Team only)
    const tenant = await Tenant.findByPk(tenantId, {
      include: [{ model: Plan, as: 'Plan' }],
    });
    const planId = tenant?.plan_id || tenant?.Plan?.id || 'free';
    if (planId === 'free') {
      return res.status(403).json({
        error: 'A exportação completa dos dados do workspace é um recurso exclusivo dos planos Pro e Team.',
        code: 'FEATURE_LOCKED_PLAN',
        upgrade_required: true,
        plan: 'free',
      });
    }

    // 2. Fetch workspace with members
    const workspace = await Workspace.findOne({
      where: { id, tenant_id: tenantId },
      include: [
        {
          model: WorkspaceMember,
          as: 'Members',
          include: [{ model: User, as: 'User', attributes: ['id', 'name', 'email', 'role'] }],
        },
      ],
    });

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace não encontrado' });
    }

    // 3. Fetch all associated data
    const [clients, timeSessions, tasks, sharedReports, invoices, currentUser] = await Promise.all([
      Client.findAll({
        where: { tenant_id: tenantId },
        include: [{ model: ClientContact, as: 'Contacts' }],
        order: [['name', 'ASC']],
      }),
      TimeSession.findAll({
        where: { tenant_id: tenantId },
        order: [['start_time', 'DESC']],
      }),
      Task.findAll({
        where: { tenant_id: tenantId },
        order: [['created_at', 'DESC']],
      }),
      SharedReport.findAll({
        where: { tenant_id: tenantId },
        order: [['created_at', 'DESC']],
      }),
      Invoice.findAll({
        where: { tenant_id: tenantId },
        order: [['created_at', 'DESC']],
      }),
      User.findByPk(userId, { attributes: ['id', 'name', 'email'] }),
    ]);

    const calcDurationSeconds = (s: any) => {
      const start = s.start_time ? new Date(s.start_time).getTime() : Date.now();
      const end = s.end_time ? new Date(s.end_time).getTime() : Date.now();
      return Math.max(0, Math.floor((end - start) / 1000));
    };

    const totalDurationSeconds = timeSessions.reduce((acc, s) => acc + calcDurationSeconds(s), 0);
    const totalDurationHours = Number((totalDurationSeconds / 3600).toFixed(2));

    const exportPayload = {
      export_metadata: {
        format: 'cronos_workspace_export',
        version: '1.0',
        exported_at: new Date().toISOString(),
        exported_by: currentUser
          ? {
              id: currentUser.id,
              name: currentUser.name,
              email: currentUser.email,
            }
          : null,
        workspace_info: {
          id: workspace.id,
          name: workspace.name,
          description: workspace.description,
        },
        tenant: {
          id: tenant?.id,
          name: tenant?.name,
          plan: planId,
        },
        summary: {
          total_clients: clients.length,
          total_sessions: timeSessions.length,
          total_duration_hours: totalDurationHours,
          total_tasks: tasks.length,
          total_invoices: invoices.length,
          total_shared_reports: sharedReports.length,
          total_members: workspace.Members?.length || 1,
        },
      },
      workspace: {
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
        git_provider: workspace.git_provider,
        github_repo: workspace.github_repo,
        gitlab_url: workspace.gitlab_url,
        gitlab_project: workspace.gitlab_project,
        allowed_repositories: workspace.allowed_repositories,
        default_target_minutes: workspace.default_target_minutes,
        default_client_daily_target_minutes: workspace.default_client_daily_target_minutes,
        monthly_billing_goal: workspace.monthly_billing_goal,
        created_at: (workspace as any).created_at,
        updated_at: (workspace as any).updated_at,
      },
      members: (workspace.Members || []).map((m: any) => ({
        id: m.id,
        role: m.role,
        user: m.User ? { id: m.User.id, name: m.User.name, email: m.User.email } : null,
        created_at: m.created_at,
      })),
      clients: clients.map((c) => ({
        id: c.id,
        name: c.name,
        company: c.company,
        email: c.email,
        hourly_rate: c.hourly_rate,
        daily_target_minutes: c.daily_target_minutes,
        notes: c.notes,
        git_provider: c.git_provider,
        github_repo: c.github_repo,
        gitlab_url: c.gitlab_url,
        gitlab_project: c.gitlab_project,
        created_at: (c as any).created_at,
      })),
      time_sessions: timeSessions.map((s) => ({
        id: s.id,
        client_id: s.client_id,
        title: s.title,
        notes: s.notes,
        start_time: s.start_time,
        end_time: s.end_time,
        duration_seconds: calcDurationSeconds(s),
        target_minutes: s.target_minutes,
        hourly_rate: s.hourly_rate,
        is_locked: s.is_locked,
        locked_at: s.locked_at,
        locked_reason: s.locked_reason,
        created_at: (s as any).created_at,
      })),
      tasks: tasks.map((t) => ({
        id: t.id,
        time_session_id: t.time_session_id,
        description: t.description,
        notes: t.notes,
        link: t.link,
        created_at: (t as any).created_at,
      })),
      shared_reports: sharedReports.map((r) => ({
        id: r.id,
        client_id: r.client_id,
        title: r.title,
        token: r.token,
        start_date: r.start_date,
        end_date: r.end_date,
        session_id: r.session_id,
        hourly_rate: r.hourly_rate,
        include_cost: r.include_cost,
        allow_approval: r.allow_approval,
        status: r.status,
        approved_by: r.approved_by,
        approved_at: r.approved_at,
        created_at: (r as any).created_at,
      })),
      invoices: invoices.map((inv) => ({
        id: inv.id,
        amount: inv.amount,
        currency: inv.currency,
        status: inv.status,
        billing_reason: inv.billing_reason,
        paid_at: inv.paid_at,
        created_at: inv.created_at,
      })),
    };

    const safeName = (workspace.name || 'workspace').toLowerCase().replace(/[^a-z0-9_-]/gi, '_');
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `cronos-workspace-${safeName}-${dateStr}.json`;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(JSON.stringify(exportPayload, null, 2));
  } catch (error) {
    console.error('Error exporting workspace data:', error);
    return res.status(500).json({ error: 'Erro ao processar exportação completa do workspace' });
  }
});

/**
 * GET /api/workspaces/export - Export first/current workspace of tenant
 */
workspacesRouter.get('/export', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const firstWs = await Workspace.findOne({
      where: { tenant_id: tenantId },
      order: [['created_at', 'ASC']],
    });
    if (!firstWs) {
      return res.status(404).json({ error: 'Nenhum workspace encontrado' });
    }
    return res.redirect(`/api/workspaces/${firstWs.id}/export`);
  } catch (error) {
    console.error('Error redirecting to workspace export:', error);
    return res.status(500).json({ error: 'Erro ao localizar workspace para exportação' });
  }
});
