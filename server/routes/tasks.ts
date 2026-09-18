import { Router, Response } from 'express';
import { Task, TimeSession } from '../db';
import { authMiddleware, AuthenticatedRequest } from '../auth';

export const tasksRouter = Router();

tasksRouter.use(authMiddleware);

// POST /api/tasks
// Cria uma anotação. Requer o time_session_id (ID da sessão ativa)
tasksRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { time_session_id, description, notes, link } = req.body;

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

    if (session.is_locked) {
      return res.status(403).json({
        error: 'Esta sessão está aprovada e bloqueada no banco de dados. Não é possível adicionar tarefas.',
      });
    }

    const newTask = await Task.create({
      tenant_id: req.tenantId!,
      time_session_id,
      description: description.trim(),
      notes: notes ? String(notes).trim() : null,
      link: link ? String(link).trim() : null,
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

// POST /api/tasks/batch
// Cria múltiplas tarefas em lote para uma sessão (ex: vindas de aprovação de commits)
tasksRouter.post('/batch', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { time_session_id, tasks } = req.body || {};

    if (!time_session_id) {
      return res.status(400).json({ error: 'ID da sessão de tempo é obrigatório' });
    }

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({ error: 'Lista de tarefas vazia ou inválida' });
    }

    const session = await TimeSession.findOne({
      where: {
        id: time_session_id,
        tenant_id: req.tenantId!,
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Sessão de tempo não encontrada' });
    }

    if (session.is_locked) {
      return res.status(403).json({
        error: 'Esta sessão está aprovada e bloqueada no banco de dados. Não é possível adicionar tarefas.',
      });
    }

    const createdTasks: Task[] = [];
    for (const item of tasks) {
      const desc = item.description || item.title;
      if (desc && String(desc).trim()) {
        const created = await Task.create({
          tenant_id: req.tenantId!,
          time_session_id,
          description: String(desc).trim(),
          notes: item.notes ? String(item.notes).trim() : null,
          link: item.link ? String(item.link).trim() : null,
        });
        createdTasks.push(created);
      }
    }

    return res.status(201).json({
      message: `${createdTasks.length} tarefa(s) adicionada(s) com sucesso à sessão`,
      tasks: createdTasks,
      count: createdTasks.length,
    });
  } catch (err: any) {
    console.error('Error creating batch tasks:', err);
    res.status(500).json({ error: 'Erro ao criar tarefas em lote' });
  }
});

// PATCH /api/tasks/:id
// Atualiza uma anotação de tarefa (ex: observações ou descrição)
tasksRouter.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { notes, description, link } = req.body;

    const task = await Task.findOne({
      where: {
        id,
        tenant_id: req.tenantId!,
      },
    });

    if (!task) {
      return res.status(404).json({ error: 'Tarefa não encontrada' });
    }

    // Verificar se a sessão correspondente está bloqueada (aprovada)
    const session = await TimeSession.findOne({
      where: {
        id: task.time_session_id,
        tenant_id: req.tenantId!,
      },
    });

    if (session?.is_locked) {
      return res.status(403).json({
        error: 'Esta tarefa pertence a uma sessão aprovada e bloqueada no banco de dados. Edições não são permitidas.',
      });
    }

    if (description !== undefined && typeof description === 'string' && description.trim()) {
      task.description = description.trim();
    }

    if (notes !== undefined) {
      task.notes = typeof notes === 'string' ? notes.trim() || null : null;
    }

    if (link !== undefined) {
      task.link = typeof link === 'string' ? link.trim() || null : null;
    }

    await task.save();

    return res.json({
      message: 'Tarefa atualizada com sucesso',
      task,
    });
  } catch (err: any) {
    console.error('Error updating task:', err);
    res.status(500).json({ error: 'Erro ao atualizar tarefa' });
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

    // Verificar se a sessão correspondente está bloqueada (aprovada)
    const session = await TimeSession.findOne({
      where: {
        id: task.time_session_id,
        tenant_id: req.tenantId!,
      },
    });

    if (session?.is_locked) {
      return res.status(403).json({
        error: 'Esta tarefa pertence a uma sessão aprovada e bloqueada no banco de dados. Exclusões não são permitidas.',
      });
    }

    await task.destroy();

    return res.json({ message: 'Tarefa removida com sucesso' });
  } catch (err: any) {
    console.error('Error deleting task:', err);
    res.status(500).json({ error: 'Erro ao remover tarefa' });
  }
});
