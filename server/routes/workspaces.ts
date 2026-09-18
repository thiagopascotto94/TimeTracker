import { Router, Response } from 'express';
import { Workspace, WorkspaceMember, User, Subscription, Plan } from '../db';
import { authMiddleware, requireRole, AuthenticatedRequest } from '../auth';

export const workspacesRouter = Router();

workspacesRouter.use(authMiddleware);

// GET /api/workspaces - List workspaces of authenticated user
workspacesRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const tenantId = req.tenantId!;

    const memberships = await WorkspaceMember.findAll({
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
    });

    const workspaces = memberships.map((m) => {
      const ws = m.Workspace!;
      const membersCount = ws.Members ? ws.Members.length : 0;
      return {
        id: ws.id,
        name: ws.name,
        description: ws.description,
        role: m.role,
        members_count: membersCount,
        created_at: ws.created_at,
        updated_at: ws.updated_at,
        is_active: ws.id === req.workspaceId,
      };
    });

    return res.json({ workspaces, activeWorkspaceId: req.workspaceId });
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
        error: `Limite de workspaces (${maxWorkspaces}) atingido para o seu plano atual. Faça upgrade para criar mais workspaces.`,
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

    const workspace = await Workspace.findByPk(id, {
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

    return res.json({
      workspace: {
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
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
    const { name, description } = req.body;

    const workspace = await Workspace.findByPk(id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace não encontrado' });
    }

    if (name && name.trim()) {
      workspace.name = name.trim();
    }
    if (description !== undefined) {
      workspace.description = description ? description.trim() : null;
    }
    await workspace.save();

    return res.json({
      workspace: {
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
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
