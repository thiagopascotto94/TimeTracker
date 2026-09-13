import { Router, Request, Response } from 'express';
import { Op } from 'sequelize';
import { SharedReport, TimeSession, Task, Tenant, Client } from '../db';
import { calculateSessionMetrics } from './reports';

export const publicRouter = Router();

// GET /api/public/shared/:token
// Rota sem middleware de sessão. Retorna os dados agregados vinculados ao token para leitura.
publicRouter.get('/shared/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: 'Token de compartilhamento não informado' });
    }

    // Try finding in SharedReports first
    const shared = await SharedReport.findOne({
      where: { token },
      include: [
        {
          model: Client,
          as: 'Client',
        },
      ],
    });

    let tenantId: string | null = null;
    let hourlyRate = 150.0;
    let title = 'Relatório de Prestação de Contas';
    let includeCost = true;
    let allowApproval = true;
    let whereClause: any = {};

    if (shared) {
      tenantId = shared.tenant_id;
      hourlyRate = shared.hourly_rate;
      title = shared.title;
      includeCost =
        shared.include_cost !== undefined && shared.include_cost !== null
          ? shared.include_cost === true || (shared.include_cost as any) === 1 || (shared.include_cost as any) === '1'
          : true;
      allowApproval =
        shared.allow_approval !== undefined && shared.allow_approval !== null
          ? shared.allow_approval === true || (shared.allow_approval as any) === 1 || (shared.allow_approval as any) === '1'
          : true;

      whereClause = { tenant_id: tenantId };
      if (shared.session_id) {
        whereClause.id = shared.session_id;
      } else {
        if (shared.client_id) {
          whereClause.client_id = shared.client_id;
        }
        if (shared.start_date || shared.end_date) {
          whereClause.start_time = {};
          if (shared.start_date) {
            const start = new Date(shared.start_date);
            start.setHours(0, 0, 0, 0);
            whereClause.start_time[Op.gte] = start;
          }
          if (shared.end_date) {
            const end = new Date(shared.end_date);
            end.setHours(23, 59, 59, 999);
            whereClause.start_time[Op.lte] = end;
          }
        }
      }
    } else {
      // Check if it's a direct session public_token
      const sessionByToken = await TimeSession.findOne({
        where: { public_token: token },
        include: [{ model: Client, as: 'Client' }],
      });

      if (!sessionByToken) {
        return res.status(404).json({ error: 'Relatório ou sessão não encontrada ou token expirado.' });
      }

      tenantId = sessionByToken.tenant_id;
      title = `Relatório: ${sessionByToken.title}`;
      whereClause = { id: sessionByToken.id, tenant_id: tenantId };
      if (sessionByToken.Client?.hourly_rate) {
        hourlyRate = sessionByToken.Client.hourly_rate;
      }
    }

    const tenant = tenantId ? await Tenant.findByPk(tenantId) : null;

    const sessions = await TimeSession.findAll({
      where: whereClause,
      include: [
        {
          model: Task,
          as: 'Tasks',
        },
        {
          model: Client,
          as: 'Client',
        },
      ],
      order: [['start_time', 'DESC']],
    });

    let totalDurationMs = 0;
    let totalTasksCount = 0;
    let totalBillableAmount = 0;
    const appliedRates = new Set<number>();

    const mappedSessions = sessions.map((sess) => {
      // O valor da sessão é calculado por sessão/cliente
      const sessionRate = sess.Client?.hourly_rate ?? hourlyRate;
      appliedRates.add(sessionRate);

      const metrics = calculateSessionMetrics(sess, sessionRate);
      totalDurationMs += metrics.durationMs;
      totalTasksCount += sess.Tasks ? sess.Tasks.length : 0;
      // O valor final do relatório é a soma exata dos valores individuais calculados por sessão
      totalBillableAmount = Number((totalBillableAmount + metrics.billableAmount).toFixed(2));

      return {
        id: sess.id,
        title: sess.title,
        start_time: sess.start_time,
        end_time: sess.end_time,
        target_minutes: sess.target_minutes,
        client: sess.Client
          ? {
              id: sess.Client.id,
              name: sess.Client.name,
              hourly_rate: sess.Client.hourly_rate,
            }
          : null,
        tasks: (sess.Tasks || []).map((t) => ({
          id: t.id,
          description: t.description,
          created_at: t.created_at,
        })),
        metrics,
      };
    });

    const totalDecimalHours = Number((totalDurationMs / 3600000).toFixed(2));
    totalBillableAmount = Number(totalBillableAmount.toFixed(2));
    const totalMinutes = Math.round(totalDurationMs / 60000);
    const hasMultipleRates = appliedRates.size > 1;
    const effectiveRate = appliedRates.size === 1 ? Array.from(appliedRates)[0] : hourlyRate;

    return res.json({
      title,
      workspace: tenant ? tenant.name : 'Workspace',
      generated_at: new Date().toISOString(),
      approval_status: shared ? shared.status || 'pending' : 'pending',
      approved_by: shared ? shared.approved_by || null : null,
      approved_at: shared ? shared.approved_at || null : null,
      approval_ip: shared ? shared.approval_ip || null : null,
      include_cost: includeCost,
      allow_approval: allowApproval,
      summary: {
        totalDurationMs,
        totalMinutes,
        totalDecimalHours,
        hourlyRate: effectiveRate,
        hasMultipleRates,
        totalBillableAmount,
        totalSessionsCount: mappedSessions.length,
        totalTasksCount,
        currency: 'BRL',
      },
      sessions: mappedSessions,
    });
  } catch (err: any) {
    console.error('Error serving public shared report:', err);
    res.status(500).json({ error: 'Erro ao consultar relatório público' });
  }
});

// POST /api/public/shared/:token/review
// Process approval or rejection with code validation and audit tracking (IP, timestamp, approver name)
publicRouter.post('/shared/:token/review', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { action, approval_code, approver_name } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token não informado' });
    }

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Ação inválida' });
    }

    if (!approval_code || !approval_code.trim()) {
      return res.status(400).json({ error: 'Código de aprovação é obrigatório' });
    }

    if (!approver_name || !approver_name.trim()) {
      return res.status(400).json({ error: 'Nome de quem está aprovando/rejeitando é obrigatório' });
    }

    const shared = await SharedReport.findOne({ where: { token } });
    if (!shared) {
      return res.status(404).json({ error: 'Relatório compartilhado não encontrado' });
    }

    if (shared.approval_code.trim().toUpperCase() !== approval_code.trim().toUpperCase()) {
      return res.status(400).json({ error: 'Código de aprovação incorreto.' });
    }

    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const now = new Date();
    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    await shared.update({
      status: newStatus,
      approved_by: approver_name.trim(),
      approved_at: now,
      approval_ip: clientIp,
    });

    return res.json({
      message: action === 'approve' ? 'Relatório aprovado com sucesso!' : 'Relatório rejeitado com sucesso.',
      status: newStatus,
      approved_by: shared.approved_by,
      approved_at: shared.approved_at,
      approval_ip: shared.approval_ip,
    });
  } catch (err: any) {
    console.error('Error reviewing shared report:', err);
    res.status(500).json({ error: 'Erro ao processar aprovação/rejeição' });
  }
});
