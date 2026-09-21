import { Router, Response } from 'express';
import { Op } from 'sequelize';
import { Note, User, WorkspaceMember } from '../db';
import { authMiddleware, AuthenticatedRequest } from '../auth';

export const notesRouter = Router();

notesRouter.use(authMiddleware);

// GET /api/notes
notesRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const workspaceId = req.workspaceId;
    const userId = req.userId;

    if (!tenantId || !userId) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    const notes = await Note.findAll({
      where: {
        tenant_id: tenantId,
        ...(workspaceId ? { workspace_id: workspaceId } : {}),
        [Op.or]: [
          { is_workspace_shared: true },
          { user_id: userId },
        ],
      },
      include: [
        {
          model: User,
          as: 'Author',
          attributes: ['id', 'name', 'email'],
        },
      ],
      order: [
        ['is_pinned', 'DESC'],
        ['updated_at', 'DESC'],
      ],
    });

    return res.json({ notes });
  } catch (err: any) {
    console.error('Error fetching notes:', err);
    return res.status(500).json({ error: 'Erro ao buscar notas' });
  }
});

// POST /api/notes
notesRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const workspaceId = req.workspaceId;
    const userId = req.userId;

    if (!tenantId || !userId || !workspaceId) {
      return res.status(401).json({ error: 'Não autorizado ou workspace não selecionado' });
    }

    const { title, content, is_workspace_shared, is_pinned } = req.body;

    const note = await Note.create({
      tenant_id: tenantId,
      workspace_id: workspaceId,
      user_id: userId,
      title: title && title.trim() ? title.trim() : 'Nova Nota',
      content: content || '',
      is_workspace_shared: Boolean(is_workspace_shared),
      is_pinned: Boolean(is_pinned),
    });

    const createdNote = await Note.findByPk(note.id, {
      include: [
        {
          model: User,
          as: 'Author',
          attributes: ['id', 'name', 'email'],
        },
      ],
    });

    return res.status(201).json({ note: createdNote });
  } catch (err: any) {
    console.error('Error creating note:', err);
    return res.status(500).json({ error: 'Erro ao criar nota' });
  }
});

// PUT /api/notes/:id
notesRouter.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const userId = req.userId;
    const noteId = req.params.id;

    if (!tenantId || !userId) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    const note = await Note.findOne({
      where: { id: noteId, tenant_id: tenantId },
    });

    if (!note) {
      return res.status(404).json({ error: 'Nota não encontrada' });
    }

    // Check if user is author or workspace admin/owner
    let canEdit = note.user_id === userId;
    if (!canEdit) {
      const member = await WorkspaceMember.findOne({
        where: { workspace_id: note.workspace_id, user_id: userId },
      });
      if (member && (member.role === 'admin' || member.role === 'owner')) {
        canEdit = true;
      }
    }

    if (!canEdit) {
      return res.status(403).json({ error: 'Você não tem permissão para editar esta nota' });
    }

    const { title, content, is_workspace_shared, is_pinned } = req.body;

    await note.update({
      title: title !== undefined ? (title.trim() ? title.trim() : 'Sem Título') : note.title,
      content: content !== undefined ? content : note.content,
      is_workspace_shared: is_workspace_shared !== undefined ? Boolean(is_workspace_shared) : note.is_workspace_shared,
      is_pinned: is_pinned !== undefined ? Boolean(is_pinned) : note.is_pinned,
    });

    const updatedNote = await Note.findByPk(note.id, {
      include: [
        {
          model: User,
          as: 'Author',
          attributes: ['id', 'name', 'email'],
        },
      ],
    });

    return res.json({ note: updatedNote });
  } catch (err: any) {
    console.error('Error updating note:', err);
    return res.status(500).json({ error: 'Erro ao atualizar nota' });
  }
});

// DELETE /api/notes/:id
notesRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const userId = req.userId;
    const noteId = req.params.id;

    if (!tenantId || !userId) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    const note = await Note.findOne({
      where: { id: noteId, tenant_id: tenantId },
    });

    if (!note) {
      return res.status(404).json({ error: 'Nota não encontrada' });
    }

    let canDelete = note.user_id === userId;
    if (!canDelete) {
      const member = await WorkspaceMember.findOne({
        where: { workspace_id: note.workspace_id, user_id: userId },
      });
      if (member && (member.role === 'admin' || member.role === 'owner')) {
        canDelete = true;
      }
    }

    if (!canDelete) {
      return res.status(403).json({ error: 'Você não tem permissão para excluir esta nota' });
    }

    await note.destroy();

    return res.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting note:', err);
    return res.status(500).json({ error: 'Erro ao excluir nota' });
  }
});
