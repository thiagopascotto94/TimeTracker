import { Router, Response } from 'express';
import { TimeSession, Task, Client } from '../db';
import { authMiddleware, AuthenticatedRequest } from '../auth';
import { checkPlanLimit } from '../billing';
import { Op } from 'sequelize';
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
        ...(req.workspaceId
          ? {
              [Op.or]: [
                { workspace_id: req.workspaceId },
                { workspace_id: null },
              ],
            }
          : {}),
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
    const { search, startDate, endDate, clientId } = req.query;
    const where: any = {
      tenant_id: req.tenantId!,
      user_id: req.userId!,
      ...(req.workspaceId
        ? {
            [Op.or]: [
              { workspace_id: req.workspaceId },
              { workspace_id: null },
            ],
          }
        : {}),
    };

    if (clientId && clientId !== 'all') {
      where.client_id = clientId;
    }

    if (startDate) {
      where.start_time = {
        ...(where.start_time || {}),
        [Op.gte]: new Date(startDate as string),
      };
    }

    if (endDate) {
      const endD = new Date(endDate as string);
      endD.setHours(23, 59, 59, 999);
      where.start_time = {
        ...(where.start_time || {}),
        [Op.lte]: endD,
      };
    }

    if (search && typeof search === 'string' && search.trim()) {
      const q = `%${search.trim().toLowerCase()}%`;
      where[Op.or] = [
        { title: { [Op.like]: q } },
        { notes: { [Op.like]: q } },
      ];
    }

    const sessions = await TimeSession.findAll({
      where,
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
      limit: 100,
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
sessionsRouter.post('/start', checkPlanLimit('sessions'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      target_minutes,
      previous_session_id,
      title,
      client_id,
      notes,
      start_time,
      retroactive_minutes,
      retroactive_reason,
    } = req.body;

    // Check if there is already an active session
    const existingActive = await TimeSession.findOne({
      where: {
        tenant_id: req.tenantId!,
        user_id: req.userId!,
        end_time: null,
        ...(req.workspaceId
          ? {
              [Op.or]: [
                { workspace_id: req.workspaceId },
                { workspace_id: null },
              ],
            }
          : {}),
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
          ...(req.workspaceId
            ? {
                [Op.or]: [
                  { workspace_id: req.workspaceId },
                  { workspace_id: null },
                ],
              }
            : {}),
        },
      });
    }

    const serverNow = new Date();
    let isRetroactive = false;
    let finalStartTime = serverNow;
    let resolvedRetroMinutes: number | null = null;
    let resolvedReason: string | null = null;

    // Check if backdating is requested via retroactive_minutes or past start_time
    const hasRetroMinutes = retroactive_minutes !== undefined && retroactive_minutes !== null && Number(retroactive_minutes) > 0;
    const hasPastStartTime = start_time && (serverNow.getTime() - new Date(start_time).getTime() > 60000);

    if (hasRetroMinutes || hasPastStartTime) {
      isRetroactive = true;

      // 1. Motivo obrigatório (Reason strictly mandatory)
      if (!retroactive_reason || !String(retroactive_reason).trim()) {
        return res.status(400).json({
          error: 'É obrigatório informar o motivo para iniciar o cronômetro com horário retroativo (ex: "Esqueci de iniciar o timer").',
        });
      }
      resolvedReason = String(retroactive_reason).trim();

      // 2. Fetch workspace / tenant max retroactive minutes limit
      let maxAllowedMinutes = 120; // default 2 hours
      if (req.workspaceId) {
        const { Workspace } = await import('../db');
        const ws = await Workspace.findByPk(req.workspaceId);
        if (ws && ws.max_retroactive_minutes !== undefined && ws.max_retroactive_minutes !== null) {
          maxAllowedMinutes = ws.max_retroactive_minutes;
        }
      } else if (req.tenant) {
        if (req.tenant.max_retroactive_minutes !== undefined && req.tenant.max_retroactive_minutes !== null) {
          maxAllowedMinutes = req.tenant.max_retroactive_minutes;
        }
      }

      if (maxAllowedMinutes === 0) {
        return res.status(400).json({
          error: 'O início retroativo do cronômetro foi desativado pelo administrador deste workspace (limite: 0 minutos).',
        });
      }

      // Calculate the retroactive start time and difference in minutes
      if (hasRetroMinutes) {
        const minutesNum = Math.max(1, Math.round(Number(retroactive_minutes)));
        resolvedRetroMinutes = minutesNum;
        finalStartTime = new Date(serverNow.getTime() - minutesNum * 60 * 1000);
      } else {
        const parsedStart = new Date(start_time);
        if (isNaN(parsedStart.getTime())) {
          return res.status(400).json({ error: 'Horário de início retroativo inválido.' });
        }
        if (parsedStart.getTime() > serverNow.getTime() + 60000) {
          return res.status(400).json({ error: 'Não é possível iniciar uma sessão com horário no futuro.' });
        }
        finalStartTime = parsedStart;
        resolvedRetroMinutes = Math.max(1, Math.round((serverNow.getTime() - parsedStart.getTime()) / 60000));
      }

      // Check max retroactive limit
      if (resolvedRetroMinutes > maxAllowedMinutes) {
        return res.status(400).json({
          error: `O tempo retroativo selecionado (${resolvedRetroMinutes} min) excede o limite máximo permitido pelo workspace (${maxAllowedMinutes} min / ${(maxAllowedMinutes / 60).toFixed(1)}h).`,
        });
      }

      // Check for overlap with existing completed sessions
      const overlappingSession = await TimeSession.findOne({
        where: {
          tenant_id: req.tenantId!,
          user_id: req.userId!,
          end_time: { [Op.gt]: finalStartTime },
          start_time: { [Op.lt]: serverNow },
        },
        order: [['end_time', 'DESC']],
      });

      if (overlappingSession && overlappingSession.end_time) {
        const overlapEndStr = new Date(overlappingSession.end_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        return res.status(400).json({
          error: `Conflito de horário: já existe uma sessão gravada finalizada às ${overlapEndStr} ("${overlappingSession.title}"). Escolha um horário após o término desta sessão.`,
        });
      }
    }

    const publicToken = crypto.randomBytes(16).toString('hex');

    const newSession = await TimeSession.create({
      tenant_id: req.tenantId!,
      workspace_id: req.workspaceId || null,
      user_id: req.userId!,
      client_id: client_id || (prevSession ? prevSession.client_id : null),
      title: title?.trim() || (prevSession ? `Continuação: ${prevSession.title}` : 'Sessão de Foco'),
      notes: notes ? String(notes).trim() : null,
      start_time: finalStartTime,
      end_time: null,
      target_minutes: target_minutes ? Number(target_minutes) : null,
      previous_session_id: prevSession ? prevSession.id : null,
      public_token: publicToken,
      is_retroactive: isRetroactive,
      retroactive_reason: resolvedReason,
      retroactive_minutes: resolvedRetroMinutes,
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
          if (t.link !== undefined) {
            updateData.link = typeof t.link === 'string' ? t.link.trim() || null : null;
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
            link: t.link ? String(t.link).trim() : null,
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
