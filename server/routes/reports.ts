import { Router, Response } from 'express';
import { Op } from 'sequelize';
import { TimeSession, Task, User, SharedReport, Client } from '../db';
import { authMiddleware, AuthenticatedRequest } from '../auth';
import crypto from 'crypto';

export const reportsRouter = Router();

reportsRouter.use(authMiddleware);

// Helper to compute session stats
export function calculateSessionMetrics(session: any, hourlyRate: number) {
  const start = new Date(session.start_time).getTime();
  const end = session.end_time ? new Date(session.end_time).getTime() : Date.now();
  const durationMs = Math.max(0, end - start);
  const durationMinutes = Math.round(durationMs / 60000);
  const decimalHours = Number((durationMs / 3600000).toFixed(2));
  const billableAmount = Number((decimalHours * hourlyRate).toFixed(2));

  return {
    durationMs,
    durationMinutes,
    decimalHours,
    billableAmount,
    isActive: !session.end_time,
  };
}

// GET /api/reports
// Lista sessões e tarefas por período e cliente, já trazendo o cálculo de horas e valor financeiro.
reportsRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate, sessionId, clientId } = req.query;
    const defaultHourlyRate = req.user?.default_hourly_rate ?? 150.0;

    const whereClause: any = {
      tenant_id: req.tenantId!,
      user_id: req.userId!,
    };

    if (sessionId) {
      whereClause.id = sessionId;
    }
    if (clientId) {
      whereClause.client_id = clientId;
    }
    if (!sessionId && (startDate || endDate)) {
      whereClause.start_time = {};
      if (startDate) {
        const start = new Date(startDate as string);
        start.setHours(0, 0, 0, 0);
        whereClause.start_time[Op.gte] = start;
      }
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        whereClause.start_time[Op.lte] = end;
      }
    }

    const sessions = await TimeSession.findAll({
      where: whereClause,
      include: [
        {
          model: Task,
          as: 'Tasks',
        },
        {
          model: TimeSession,
          as: 'PreviousSession',
          attributes: ['id', 'title', 'start_time', 'end_time'],
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

    const mappedSessions = sessions.map((sess) => {
      const rate = sess.Client?.hourly_rate ?? defaultHourlyRate;
      const metrics = calculateSessionMetrics(sess, rate);
      totalDurationMs += metrics.durationMs;
      totalTasksCount += sess.Tasks ? sess.Tasks.length : 0;
      totalBillableAmount += metrics.billableAmount;

      return {
        id: sess.id,
        title: sess.title,
        start_time: sess.start_time,
        end_time: sess.end_time,
        target_minutes: sess.target_minutes,
        previous_session_id: sess.previous_session_id,
        previous_session: sess.PreviousSession,
        client: sess.Client || null,
        public_token: sess.public_token,
        tasks: sess.Tasks || [],
        metrics,
      };
    });

    const totalDecimalHours = Number((totalDurationMs / 3600000).toFixed(2));
    totalBillableAmount = Number(totalBillableAmount.toFixed(2));
    const totalMinutes = Math.round(totalDurationMs / 60000);

    // Grouping by Date (YYYY-MM-DD)
    const groupedByDay: Record<string, { date: string; decimalHours: number; billableAmount: number; sessionsCount: number }> = {};
    for (const s of mappedSessions) {
      const dateKey = new Date(s.start_time).toISOString().split('T')[0];
      if (!groupedByDay[dateKey]) {
        groupedByDay[dateKey] = {
          date: dateKey,
          decimalHours: 0,
          billableAmount: 0,
          sessionsCount: 0,
        };
      }
      groupedByDay[dateKey].decimalHours = Number(
        (groupedByDay[dateKey].decimalHours + s.metrics.decimalHours).toFixed(2)
      );
      groupedByDay[dateKey].billableAmount = Number(
        (groupedByDay[dateKey].billableAmount + s.metrics.billableAmount).toFixed(2)
      );
      groupedByDay[dateKey].sessionsCount += 1;
    }

    return res.json({
      summary: {
        totalDurationMs,
        totalMinutes,
        totalDecimalHours,
        hourlyRate: defaultHourlyRate,
        totalBillableAmount,
        totalSessionsCount: mappedSessions.length,
        totalTasksCount,
        currency: 'BRL',
      },
      groupedByDay: Object.values(groupedByDay).sort((a, b) => b.date.localeCompare(a.date)),
      sessions: mappedSessions,
    });
  } catch (err: any) {
    console.error('Error generating report:', err);
    res.status(500).json({ error: 'Erro ao gerar relatório' });
  }
});

// POST /api/reports/share
// Gera e salva um public_token para um conjunto de dados ou sessão específica.
reportsRouter.post('/share', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, start_date, end_date, session_id } = req.body;
    const hourlyRate = req.user?.default_hourly_rate ?? 150.0;

    const token = crypto.randomBytes(16).toString('hex');
    const approvalCode = crypto.randomBytes(3).toString('hex').toUpperCase();

    const sharedReport = await SharedReport.create({
      tenant_id: req.tenantId!,
      token,
      title: title?.trim() || 'Relatório de Prestação de Contas',
      start_date: start_date || null,
      end_date: end_date || null,
      session_id: session_id || null,
      hourly_rate: hourlyRate,
      approval_code: approvalCode,
      status: 'pending',
    });

    // If a specific session was shared, also sync public_token on the session
    if (session_id) {
      await TimeSession.update(
        { public_token: token },
        { where: { id: session_id, tenant_id: req.tenantId! } }
      );
    }

    return res.status(201).json({
      message: 'Link de compartilhamento gerado com sucesso',
      token: sharedReport.token,
      approval_code: sharedReport.approval_code,
      sharePath: `/shared/${sharedReport.token}`,
      report: sharedReport,
    });
  } catch (err: any) {
    console.error('Error creating shared report token:', err);
    res.status(500).json({ error: 'Erro ao compartilhar relatório' });
  }
});
