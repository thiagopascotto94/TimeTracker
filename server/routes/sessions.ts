import { Router, Response } from 'express';
import { TimeSession, Task, Client } from '../db';
import { authMiddleware, AuthenticatedRequest } from '../auth';
import crypto from 'crypto';

export const sessionsRouter = Router();

// Apply auth middleware to all session routes
sessionsRouter.use(authMiddleware);

// GET /api/sessions/active
// Busca se existe alguma sessão sem end_time para o usuário e tenant
sessionsRouter.get('/active', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const activeSession = await TimeSession.findOne({
      where: {
        tenant_id: req.tenantId!,
        user_id: req.userId!,
        end_time: null,
      },
      include: [
        {
          model: Task,
          as: 'Tasks',
        },
        {
          model: TimeSession,
          as: 'PreviousSession',
        },
        {
          model: Client,
          as: 'Client',
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    return res.json({ session: activeSession || null });
  } catch (err: any) {
    console.error('Error fetching active session:', err);
    res.status(500).json({ error: 'Erro ao buscar sessão ativa' });
  }
});

// GET /api/sessions (list recent sessions for continuation & logs)
sessionsRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessions = await TimeSession.findAll({
      where: {
        tenant_id: req.tenantId!,
        user_id: req.userId!,
      },
      include: [
        {
          model: Task,
          as: 'Tasks',
        },
        {
          model: TimeSession,
          as: 'PreviousSession',
        },
        {
          model: Client,
          as: 'Client',
        },
      ],
      order: [['start_time', 'DESC']],
      limit: 50,
    });

    return res.json({ sessions });
  } catch (err: any) {
    console.error('Error listing sessions:', err);
    res.status(500).json({ error: 'Erro ao listar sessões' });
  }
});

// POST /api/sessions/start
// Inicia o timer. Recebe target_minutes, previous_session_id, client_id e notes (opcionais).
// Retorna o start_time oficial gerado pelo servidor.
sessionsRouter.post('/start', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { target_minutes, previous_session_id, title, client_id, notes } = req.body;

    // Check if there is already an active session
    const existingActive = await TimeSession.findOne({
      where: {
        tenant_id: req.tenantId!,
        user_id: req.userId!,
        end_time: null,
      },
    });

    if (existingActive) {
      return res.status(400).json({
        error: 'Já existe uma sessão de tempo em andamento. Finalize-a antes de iniciar outra.',
        session: existingActive,
      });
    }

    // Verify previous session if supplied
    let prevSession = null;
    if (previous_session_id) {
      prevSession = await TimeSession.findOne({
        where: {
          id: previous_session_id,
          tenant_id: req.tenantId!,
        },
      });
    }

    const serverStartTime = new Date();
    const publicToken = crypto.randomBytes(16).toString('hex');

    const newSession = await TimeSession.create({
      tenant_id: req.tenantId!,
      user_id: req.userId!,
      client_id: client_id || (prevSession ? prevSession.client_id : null),
      title: title?.trim() || (prevSession ? `Continuação: ${prevSession.title}` : 'Sessão de Foco'),
      notes: notes ? String(notes).trim() : null,
      start_time: serverStartTime,
      end_time: null,
      target_minutes: target_minutes ? Number(target_minutes) : null,
      previous_session_id: prevSession ? prevSession.id : null,
      public_token: publicToken,
    });

    // Fetch with associations
    const createdSession = await TimeSession.findByPk(newSession.id, {
      include: [
        { model: Task, as: 'Tasks' },
        { model: TimeSession, as: 'PreviousSession' },
        { model: Client, as: 'Client' },
      ],
    });

    return res.status(201).json({
      message: 'Sessão iniciada com sucesso',
      session: createdSession,
    });
  } catch (err: any) {
    console.error('Error starting session:', err);
    res.status(500).json({ error: 'Erro ao iniciar sessão' });
  }
});

// PATCH /api/sessions/:id
// Permite atualizar dados da sessão (título, valor da hora, observações e tarefas)
sessionsRouter.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, client_id, target_minutes, notes, hourly_rate, tasks } = req.body;

    const session = await TimeSession.findOne({
      where: {
        id,
        tenant_id: req.tenantId!,
        user_id: req.userId!,
      },
      include: [
        { model: Task, as: 'Tasks' },
        { model: TimeSession, as: 'PreviousSession' },
        { model: Client, as: 'Client' },
      ],
    });

    if (!session) {
      return res.status(404).json({ error: 'Sessão não encontrada' });
    }

    // Variável controlada pelo banco de dados: se a sessão estiver bloqueada (aprovada), nada pode ser alterado
    if (session.is_locked) {
      return res.status(403).json({
        error: 'Esta sessão está aprovada e bloqueada no banco de dados. Nenhuma alteração é permitida.',
      });
    }

    if (title !== undefined) {
      const trimmed = typeof title === 'string' ? title.trim() : '';
      session.title = trimmed || 'Sessão de Foco';
    }
    if (notes !== undefined) {
      session.notes = typeof notes === 'string' ? notes.trim() || null : null;
    }
    if (hourly_rate !== undefined) {
      session.hourly_rate = hourly_rate === null || hourly_rate === '' ? null : Number(hourly_rate);
    }
    if (client_id !== undefined) {
      session.client_id = client_id || null;
    }
    if (target_minutes !== undefined) {
      session.target_minutes = target_minutes ? Number(target_minutes) : null;
    }

    await session.save();

    // Se tarefas foram fornecidas para atualização em lote
    if (Array.isArray(tasks)) {
      for (const t of tasks) {
        if (t.id && t.is_deleted) {
          await Task.destroy({
            where: {
              id: t.id,
              time_session_id: session.id,
              tenant_id: req.tenantId!,
            },
          });
        } else if (t.id) {
          const updateData: any = {};
          if (t.description !== undefined && typeof t.description === 'string') {
            updateData.description = t.description.trim() || 'Tarefa';
          }
          if (t.notes !== undefined) {
            updateData.notes = typeof t.notes === 'string' ? t.notes.trim() || null : null;
          }
          if (Object.keys(updateData).length > 0) {
            await Task.update(updateData, {
              where: {
                id: t.id,
                time_session_id: session.id,
                tenant_id: req.tenantId!,
              },
            });
          }
        } else if (t.description && String(t.description).trim()) {
          await Task.create({
            tenant_id: req.tenantId!,
            time_session_id: session.id,
            description: String(t.description).trim(),
            notes: t.notes ? String(t.notes).trim() : null,
          });
        }
      }
    }

    // Recarregar sessão com associações atualizadas
    const updatedSession = await TimeSession.findByPk(session.id, {
      include: [
        { model: Task, as: 'Tasks' },
        { model: TimeSession, as: 'PreviousSession' },
        { model: Client, as: 'Client' },
      ],
    });

    return res.json({
      message: 'Sessão atualizada com sucesso',
      session: updatedSession,
    });
  } catch (err: any) {
    console.error('Error updating session:', err);
    res.status(500).json({ error: 'Erro ao atualizar sessão' });
  }
});

// PUT /api/sessions/:id/stop
// Finaliza a sessão, preenchendo o end_time e opcionalmente atualizando o título e observações antes de salvar.
sessionsRouter.put('/:id/stop', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, notes } = req.body || {};

    const session = await TimeSession.findOne({
      where: {
        id,
        tenant_id: req.tenantId!,
        user_id: req.userId!,
      },
      include: [
        { model: Task, as: 'Tasks' },
        { model: Client, as: 'Client' },
      ],
    });

    if (!session) {
      return res.status(404).json({ error: 'Sessão não encontrada' });
    }

    if (session.end_time) {
      return res.status(400).json({ error: 'Esta sessão já foi finalizada' });
    }

    if (title !== undefined && typeof title === 'string' && title.trim()) {
      session.title = title.trim();
    }

    if (notes !== undefined) {
      session.notes = typeof notes === 'string' ? notes.trim() || null : null;
    }

    const serverEndTime = new Date();
    session.end_time = serverEndTime;
    await session.save();

    return res.json({
      message: 'Sessão finalizada com sucesso',
      session,
    });
  } catch (err: any) {
    console.error('Error stopping session:', err);
    res.status(500).json({ error: 'Erro ao finalizar sessão' });
  }
});

// DELETE /api/sessions/:id
sessionsRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const session = await TimeSession.findOne({
      where: {
        id,
        tenant_id: req.tenantId!,
        user_id: req.userId!,
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Sessão não encontrada' });
    }

    if (session.is_locked) {
      return res.status(403).json({
        error: 'Esta sessão está aprovada e bloqueada no banco de dados. Exclusões não são permitidas.',
      });
    }

    // Delete tasks associated
    await Task.destroy({
      where: {
        time_session_id: id,
        tenant_id: req.tenantId!,
      },
    });

    await session.destroy();

    return res.json({ message: 'Sessão excluída com sucesso' });
  } catch (err: any) {
    console.error('Error deleting session:', err);
    res.status(500).json({ error: 'Erro ao excluir sessão' });
  }
});
