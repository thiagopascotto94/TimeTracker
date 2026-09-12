import { Router, Response } from 'express';
import { Task, TimeSession } from '../db';
import { authMiddleware, AuthenticatedRequest } from '../auth';

export const tasksRouter = Router();

tasksRouter.use(authMiddleware);

// POST /api/tasks
// Cria uma anotação. Requer o time_session_id (ID da sessão ativa)
tasksRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { time_session_id, description } = req.body;

    if (!time_session_id || !description || !description.trim()) {
      return res.status(400).json({ error: 'ID da sessão e descrição da tarefa são obrigatórios' });
    }

    // Verify that the time session exists and belongs to the current tenant
    const session = await TimeSession.findOne({
      where: {
        id: time_session_id,
        tenant_id: req.tenantId!,
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Sessão de tempo não encontrada' });
    }

    const newTask = await Task.create({
      tenant_id: req.tenantId!,
      time_session_id,
      description: description.trim(),
    });

    return res.status(201).json({
      message: 'Tarefa adicionada com sucesso',
      task: newTask,
    });
  } catch (err: any) {
    console.error('Error creating task:', err);
    res.status(500).json({ error: 'Erro ao criar tarefa' });
  }
});

// DELETE /api/tasks/:id
// Remove uma anotação
tasksRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const task = await Task.findOne({
      where: {
        id,
        tenant_id: req.tenantId!,
      },
    });

    if (!task) {
      return res.status(404).json({ error: 'Tarefa não encontrada' });
    }

    await task.destroy();

    return res.json({ message: 'Tarefa removida com sucesso' });
  } catch (err: any) {
    console.error('Error deleting task:', err);
    res.status(500).json({ error: 'Erro ao remover tarefa' });
  }
});
