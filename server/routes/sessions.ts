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
// Inicia o timer. Recebe target_minutes, previous_session_id e client_id (opcionais).
// Retorna o start_time oficial gerado pelo servidor.
sessionsRouter.post('/start', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { target_minutes, previous_session_id, title, client_id } = req.body;

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
// Permite atualizar dados da sessão em andamento, como o título
sessionsRouter.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, client_id, target_minutes } = req.body;

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

    if (title !== undefined) {
      const trimmed = title.trim();
      session.title = trimmed || 'Sessão de Foco';
    }
    if (client_id !== undefined) {
      session.client_id = client_id || null;
    }
    if (target_minutes !== undefined) {
      session.target_minutes = target_minutes ? Number(target_minutes) : null;
    }

    await session.save();

    return res.json({
      message: 'Sessão atualizada com sucesso',
      session,
    });
  } catch (err: any) {
    console.error('Error updating session:', err);
    res.status(500).json({ error: 'Erro ao atualizar sessão' });
  }
});

// PUT /api/sessions/:id/stop
// Finaliza a sessão, preenchendo o end_time e opcionalmente atualizando o título antes de salvar.
sessionsRouter.put('/:id/stop', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title } = req.body || {};

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
