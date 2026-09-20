import { Router, Response } from 'express';
import { Op } from 'sequelize';
import { TimeSession, Task, User, SharedReport, Client, Tenant } from '../db';
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
  // O valor da sessão é calculado individualmente com precisão temporal e a taxa específica desta sessão/cliente
  const exactHours = durationMs / 3600000;
  const billableAmount = Number((exactHours * hourlyRate).toFixed(2));

  return {
    durationMs,
    durationMinutes,
    decimalHours,
    hourlyRate,
    appliedHourlyRate: hourlyRate,
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

    let selectedClient: Client | null = null;
    if (clientId) {
      selectedClient = await Client.findOne({
        where: { id: clientId as string, tenant_id: req.tenantId! },
      });
    }

    const whereClause: any = {
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
    const appliedRatesSet = new Set<number>();

    const mappedSessions = sessions.map((sess) => {
      // Prioridade: Taxa da sessão editada -> Taxa personalizada do cliente -> Taxa padrão do perfil
      const sessionRate = sess.hourly_rate ?? (sess.Client?.hourly_rate ?? defaultHourlyRate);
      appliedRatesSet.add(sessionRate);

      const metrics = calculateSessionMetrics(sess, sessionRate);
      totalDurationMs += metrics.durationMs;
      totalTasksCount += sess.Tasks ? sess.Tasks.length : 0;
      // O valor final do relatório é SEMPRE o somatório exato de cada sessão individual
      totalBillableAmount = Number((totalBillableAmount + metrics.billableAmount).toFixed(2));

      return {
        id: sess.id,
        title: sess.title,
        notes: sess.notes,
        start_time: sess.start_time,
        end_time: sess.end_time,
        target_minutes: sess.target_minutes,
        hourly_rate: sess.hourly_rate,
        is_locked: sess.is_locked || false,
        locked_at: sess.locked_at,
        locked_reason: sess.locked_reason,
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

    const hasMultipleRates = appliedRatesSet.size > 1;
    const effectiveHourlyRate = selectedClient
      ? (selectedClient.hourly_rate ?? defaultHourlyRate)
      : (appliedRatesSet.size === 1 ? Array.from(appliedRatesSet)[0] : defaultHourlyRate);

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
        hourlyRate: effectiveHourlyRate,
        defaultHourlyRate,
        hasMultipleRates,
        totalBillableAmount,
        totalSessionsCount: mappedSessions.length,
        totalTasksCount,
        currency: 'BRL',
        selectedClient: selectedClient
          ? {
              id: selectedClient.id,
              name: selectedClient.name,
              hourlyRate: selectedClient.hourly_rate ?? defaultHourlyRate,
            }
          : null,
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
    const { title, start_date, end_date, session_id, client_id, include_cost, allow_approval } = req.body;
    const defaultHourlyRate = req.user?.default_hourly_rate ?? 150.0;

    let shareHourlyRate = defaultHourlyRate;
    if (client_id) {
      const client = await Client.findOne({
        where: { id: client_id, tenant_id: req.tenantId! },
      });
      if (client?.hourly_rate) {
        shareHourlyRate = client.hourly_rate;
      }
    }

    const token = crypto.randomBytes(16).toString('hex');
    const isApprovalAllowed = allow_approval !== undefined ? Boolean(allow_approval) : true;
    const isCostIncluded = include_cost !== undefined ? Boolean(include_cost) : true;
    const approvalCode = isApprovalAllowed ? crypto.randomBytes(3).toString('hex').toUpperCase() : null;

    const sharedReport = await SharedReport.create({
      tenant_id: req.tenantId!,
      token,
      title: title?.trim() || 'Relatório de Prestação de Contas',
      start_date: start_date || null,
      end_date: end_date || null,
      session_id: session_id || null,
      client_id: client_id || null,
      hourly_rate: shareHourlyRate,
      include_cost: isCostIncluded,
      allow_approval: isApprovalAllowed,
      approval_code: approvalCode || '',
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
      approval_code: isApprovalAllowed ? sharedReport.approval_code : null,
      sharePath: `/shared/${sharedReport.token}`,
      report: sharedReport,
    });
  } catch (err: any) {
    console.error('Error creating shared report token:', err);
    res.status(500).json({ error: 'Erro ao compartilhar relatório' });
  }
});

// GET /api/reports/goal
// Retorna a meta mensal definida pelo usuário e o progresso do faturamento do mês atual
reportsRouter.get('/goal', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId } = req.query;
    const tenant = await Tenant.findByPk(req.tenantId!);
    const monthlyGoal = Number(tenant?.monthly_billing_goal ?? 10000.0);
    const defaultHourlyRate = req.user?.default_hourly_rate ?? 150.0;

    const now = new Date();
    const year = now.getFullYear();
    const monthIndex = now.getMonth(); // 0-11
    const startOfMonth = new Date(year, monthIndex, 1, 0, 0, 0, 0);
    const endOfMonth = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const currentDay = now.getDate();
    const daysRemaining = Math.max(0, daysInMonth - currentDay);

    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const monthLabel = `${monthNames[monthIndex]} de ${year}`;
    const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

    const whereClause: any = {
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
      start_time: {
        [Op.gte]: startOfMonth,
        [Op.lte]: endOfMonth,
      },
    };
    if (clientId) {
      whereClause.client_id = clientId;
    }

    const sessions = await TimeSession.findAll({
      where: whereClause,
      include: [
        {
          model: Client,
          as: 'Client',
        },
      ],
      order: [['start_time', 'ASC']],
    });

    let currentMonthBilling = 0;
    let totalDurationMs = 0;

    for (const sess of sessions) {
      const sessionRate = sess.hourly_rate ?? (sess.Client?.hourly_rate ?? defaultHourlyRate);
      const startMs = new Date(sess.start_time).getTime();
      const endMs = sess.end_time ? new Date(sess.end_time).getTime() : Date.now();
      const durationMs = Math.max(0, endMs - startMs);
      totalDurationMs += durationMs;
      const hours = durationMs / 3600000;
      const billable = hours * sessionRate;
      currentMonthBilling += billable;
    }

    currentMonthBilling = Number(currentMonthBilling.toFixed(2));
    const currentMonthHours = Number((totalDurationMs / 3600000).toFixed(2));
    const percentage = monthlyGoal > 0 ? Number(((currentMonthBilling / monthlyGoal) * 100).toFixed(1)) : 0;
    const remaining = Number(Math.max(0, monthlyGoal - currentMonthBilling).toFixed(2));
    const isCompleted = currentMonthBilling >= monthlyGoal;

    const dailyAverage = currentDay > 0 ? Number((currentMonthBilling / currentDay).toFixed(2)) : 0;
    const dailyNeeded = daysRemaining > 0 ? Number((remaining / daysRemaining).toFixed(2)) : 0;

    return res.json({
      monthlyGoal,
      currentMonthBilling,
      currentMonthHours,
      monthKey,
      monthLabel,
      daysInMonth,
      currentDay,
      daysRemaining,
      dailyAverage,
      dailyNeeded,
      percentage,
      remaining,
      isCompleted,
      sessionsCount: sessions.length,
    });
  } catch (err: any) {
    console.error('Error fetching monthly goal:', err);
    res.status(500).json({ error: 'Erro ao obter meta mensal' });
  }
});

// PUT /api/reports/goal
// Atualiza a meta mensal definida pelo usuário
reportsRouter.put('/goal', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { goal } = req.body;
    const parsedGoal = Number(goal);
    if (isNaN(parsedGoal) || parsedGoal <= 0) {
      return res.status(400).json({ error: 'Meta mensal inválida. O valor deve ser positivo.' });
    }

    await Tenant.update(
      { monthly_billing_goal: parsedGoal },
      { where: { id: req.tenantId! } }
    );

    return res.json({
      success: true,
      monthlyGoal: parsedGoal,
      message: 'Meta mensal atualizada com sucesso',
    });
  } catch (err: any) {
    console.error('Error updating monthly goal:', err);
    res.status(500).json({ error: 'Erro ao atualizar meta mensal' });
  }
});

// GET /api/reports/monthly-trend
// Retorna o faturamento comparativo mensal dos últimos 6 meses
reportsRouter.get('/monthly-trend', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId } = req.query;
    const defaultHourlyRate = req.user?.default_hourly_rate ?? 150.0;

    const whereClause: any = {
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
    if (clientId) {
      whereClause.client_id = clientId;
    }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    whereClause.start_time = {
      [Op.gte]: sixMonthsAgo,
    };

    const sessions = await TimeSession.findAll({
      where: whereClause,
      include: [
        {
          model: Client,
          as: 'Client',
        },
      ],
      order: [['start_time', 'ASC']],
    });

    const monthsMap: Record<string, { monthLabel: string; billing: number; hours: number; sessionsCount: number }> = {};

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const key = `${year}-${month}`;

      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const monthLabel = `${monthNames[d.getMonth()]}/${String(year).slice(2)}`;

      monthsMap[key] = {
        monthLabel,
        billing: 0,
        hours: 0,
        sessionsCount: 0,
      };
    }

    for (const sess of sessions) {
      const start = new Date(sess.start_time);
      const year = start.getFullYear();
      const month = String(start.getMonth() + 1).padStart(2, '0');
      const key = `${year}-${month}`;

      if (monthsMap[key]) {
        const sessionRate = sess.hourly_rate ?? (sess.Client?.hourly_rate ?? defaultHourlyRate);
        const startMs = new Date(sess.start_time).getTime();
        const endMs = sess.end_time ? new Date(sess.end_time).getTime() : Date.now();
        const durationMs = Math.max(0, endMs - startMs);
        const hours = durationMs / 3600000;
        const billable = hours * sessionRate;

        monthsMap[key].billing = Number((monthsMap[key].billing + billable).toFixed(2));
        monthsMap[key].hours = Number((monthsMap[key].hours + hours).toFixed(2));
        monthsMap[key].sessionsCount += 1;
      }
    }

    const trendData = Object.keys(monthsMap).sort().map((key) => ({
      key,
      month: monthsMap[key].monthLabel,
      billing: monthsMap[key].billing,
      hours: monthsMap[key].hours,
      sessionsCount: monthsMap[key].sessionsCount,
    }));

    return res.json({ trend: trendData });
  } catch (err: any) {
    console.error('Error fetching monthly trend:', err);
    res.status(500).json({ error: 'Erro ao carregar tendência mensal' });
  }
});

// GET /api/reports/shared-links
// Retorna a lista de todos os relatórios e links compartilhados com status de aprovação e auditoria
reportsRouter.get('/shared-links', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, clientId } = req.query;
    const whereClause: any = { tenant_id: req.tenantId! };

    if (status && ['pending', 'approved', 'rejected'].includes(status as string)) {
      whereClause.status = status;
    }
    if (clientId) {
      whereClause.client_id = clientId;
    }

    const reports = await SharedReport.findAll({
      where: whereClause,
      include: [
        {
          model: Client,
          as: 'Client',
          attributes: ['id', 'name', 'hourly_rate'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    // Se houver session_id, busca os dados da sessão correspondente (para saber se está travada, etc.)
    const sessionIds = reports.map((r) => r.session_id).filter(Boolean) as string[];
    const sessionMap = new Map<string, any>();
    if (sessionIds.length > 0) {
      const sessions = await TimeSession.findAll({
        where: { id: sessionIds, tenant_id: req.tenantId! },
        attributes: ['id', 'title', 'is_locked', 'locked_reason', 'locked_at'],
      });
      sessions.forEach((s) => sessionMap.set(s.id, s));
    }

    const formatted = reports.map((r) => {
      const json = r.toJSON() as any;
      if (r.session_id && sessionMap.has(r.session_id)) {
        json.Session = sessionMap.get(r.session_id);
      }
      return json;
    });

    return res.json({ reports: formatted });
  } catch (err: any) {
    console.error('Error fetching shared report links:', err);
    return res.status(500).json({ error: 'Erro ao listar links de relatórios compartilhados' });
  }
});

// DELETE /api/reports/shared-links/:id
// Revoga e remove o link compartilhado para que não possa mais ser acessado publicamente
reportsRouter.delete('/shared-links/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const report = await SharedReport.findOne({
      where: { id, tenant_id: req.tenantId! },
    });

    if (!report) {
      return res.status(404).json({ error: 'Link de relatório não encontrado' });
    }

    // Se havia uma sessão específica associada, limpa o public_token caso seja o mesmo
    if (report.session_id) {
      await TimeSession.update(
        { public_token: null },
        {
          where: {
            id: report.session_id,
            tenant_id: req.tenantId!,
            public_token: report.token,
          },
        }
      );
    }

    await report.destroy();
    return res.json({ success: true, message: 'Link de relatório revogado com sucesso.' });
  } catch (err: any) {
    console.error('Error deleting shared report link:', err);
    return res.status(500).json({ error: 'Erro ao revogar link de relatório' });
  }
});

// PATCH /api/reports/shared-links/:id/toggle-approval
// Permite ativar/desativar a permissão de aprovação interativa do cliente para este link
reportsRouter.patch('/shared-links/:id/toggle-approval', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const report = await SharedReport.findOne({
      where: { id, tenant_id: req.tenantId! },
    });

    if (!report) {
      return res.status(404).json({ error: 'Link de relatório não encontrado' });
    }

    report.allow_approval = !report.allow_approval;
    await report.save();

    return res.json({
      success: true,
      allow_approval: report.allow_approval,
      message: `Aprovação interativa ${report.allow_approval ? 'ativada' : 'desativada'} com sucesso.`,
      report,
    });
  } catch (err: any) {
    console.error('Error toggling approval for shared report link:', err);
    return res.status(500).json({ error: 'Erro ao alterar configuração de aprovação' });
  }
});
