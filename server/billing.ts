import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import { Plan, Subscription, Tenant, User, Client, TimeSession, Workspace, WorkspaceAiDailyUsage, Invite } from './db';
import { AuthenticatedRequest } from './auth';
import { isStripeConfigured } from './stripe';

export interface PlanLimitInfo {
  current: number;
  max: number;
  percentage: number;
  unlimited: boolean;
}

export interface TeamBillingInfo {
  price_per_user_monthly: number;
  price_per_user_yearly: number;
  active_users: number;
  pending_invites: number;
  total_seats: number;
  total_monthly: number;
  total_yearly: number;
}

export interface BillingStatusData {
  plan: {
    id: string;
    name: string;
    description: string | null;
    price_monthly: number;
    price_yearly: number;
    max_workspaces: number;
    max_users: number;
    max_clients: number;
    max_sessions_per_month: number;
    max_storage_mb: number;
    features: string[];
    is_active: boolean;
  };
  subscription: {
    id: string;
    status: string;
    gateway: string;
    current_period_start: Date;
    current_period_end: Date;
    cancel_at_period_end: boolean;
    cancel_at?: Date | null;
    canceled_at?: Date | null;
    payment_method_brand?: string | null;
    payment_method_last4?: string | null;
    payment_method_exp_month?: number | null;
    payment_method_exp_year?: number | null;
  } | null;
  usage: {
    workspaces: PlanLimitInfo;
    users: PlanLimitInfo;
    clients: PlanLimitInfo;
    sessions_monthly: PlanLimitInfo;
  };
  team_billing?: TeamBillingInfo;
  can_export_workspace: boolean;
  can_create_client: boolean;
  can_create_user: boolean;
  can_create_session: boolean;
  is_stripe_configured: boolean;
  available_plans: Array<{
    id: string;
    name: string;
    description: string | null;
    price_monthly: number;
    price_yearly: number;
    max_workspaces: number;
    max_users: number;
    max_clients: number;
    max_sessions_per_month: number;
    features: string[];
  }>;
}

/**
 * Calculates current usage vs. limits for a tenant.
 */
export async function getTenantBillingStatus(tenantId: string): Promise<BillingStatusData> {
  const tenant = await Tenant.findByPk(tenantId, {
    include: [{ model: Plan, as: 'Plan' }],
  });

  let plan = tenant?.Plan;
  if (!plan) {
    plan = (await Plan.findByPk(tenant?.plan_id || 'free')) || (await Plan.findByPk('free'));
  }

  // Fetch current active subscription
  let subscription = await Subscription.findOne({
    where: { tenant_id: tenantId },
    order: [['created_at', 'DESC']],
  });

  // Downgrade automático se o período pago já terminou e a assinatura estava marcada para cancelamento
  if (subscription && subscription.cancel_at_period_end && new Date() > new Date(subscription.current_period_end)) {
    subscription.status = 'canceled';
    subscription.cancel_at_period_end = false;
    subscription.canceled_at = new Date();
    await subscription.save();

    if (tenant && tenant.plan_id !== 'free') {
      tenant.plan_id = 'free';
      await tenant.save();
      plan = (await Plan.findByPk('free')) || plan;
    }
  }

  // Fallback safe default plan if table wasn't seeded yet
  if (!plan) {
    plan = {
      id: 'free',
      name: 'Free',
      description: 'Plano Gratuito Padrão',
      price_monthly: 0,
      price_yearly: 0,
      max_users: 1,
      max_clients: 3,
      max_storage_mb: 500,
      features: '[]',
      is_active: true,
    } as Plan;
  }

  // Calculate counts
  const usersCount = await User.count({ where: { tenant_id: tenantId } });
  const clientsCount = await Client.count({ where: { tenant_id: tenantId } });

  // Calculate monthly sessions count for current calendar month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const monthlySessionsCount = await TimeSession.count({
    where: {
      tenant_id: tenantId,
      start_time: {
        [Op.gte]: startOfMonth,
      },
    },
  });

  const workspacesCount = 1; // Current tenant workspace

  // Calculate storage usage in MB
  const maxWorkspaces = plan.max_workspaces ?? 1;
  const maxUsers = plan.max_users ?? 1;
  const maxClients = plan.max_clients ?? 3;
  const maxSessionsMonthly = plan.max_sessions_per_month ?? -1;

  // Count pending invitations to calculate dynamic seat usage (minimum 5 seats for team plan)
  const pendingInvitesCount = await Invite.count({
    where: { tenant_id: tenantId, status: 'pending' },
  });
  const totalSeats = Math.max(5, usersCount + pendingInvitesCount);
  const teamPerUserMonthly = 4.99;
  const teamPerUserYearly = 49.90;
  const teamTotalMonthly = Number((totalSeats * teamPerUserMonthly).toFixed(2));
  const teamTotalYearly = Number((totalSeats * teamPerUserYearly).toFixed(2));

  const workspacesUnlimited = maxWorkspaces === -1;
  const usersUnlimited = plan.id === 'team';
  const clientsUnlimited = maxClients === -1;
  const sessionsUnlimited = maxSessionsMonthly === -1;

  const workspacesPercentage = workspacesUnlimited ? 0 : Math.min(100, Math.round((workspacesCount / maxWorkspaces) * 100));
  const usersPercentage = usersUnlimited ? 0 : Math.min(100, Math.round((usersCount / maxUsers) * 100));
  const clientsPercentage = clientsUnlimited ? 0 : Math.min(100, Math.round((clientsCount / maxClients) * 100));
  const sessionsPercentage = sessionsUnlimited ? 0 : Math.min(100, Math.round((monthlySessionsCount / maxSessionsMonthly) * 100));

  // Only the Team plan accepts inviting and adding members (Pro is individual)
  const canCreateUser = plan.id === 'team';
  const canExportWorkspace = plan.id === 'pro' || plan.id === 'team';
  const canCreateClient = clientsUnlimited || clientsCount < maxClients;
  const canCreateSession = sessionsUnlimited || monthlySessionsCount < maxSessionsMonthly;

  // Fetch all available plans for upgrade choices
  const allPlans = await Plan.findAll({ where: { is_active: true } });
  const availablePlans = allPlans.map((p) => {
    let parsedFeatures: string[] = [];
    try {
      if (p.features) {
        parsedFeatures = JSON.parse(p.features);
      }
    } catch {
      parsedFeatures = [];
    }
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      price_monthly: p.price_monthly,
      price_yearly: p.price_yearly,
      max_workspaces: p.max_workspaces ?? (p.id === 'free' ? 1 : -1),
      max_users: p.max_users,
      max_clients: p.max_clients,
      max_sessions_per_month: p.max_sessions_per_month ?? (p.id === 'free' ? 50 : -1),
      features: parsedFeatures,
    };
  });

  let currentPlanFeatures: string[] = [];
  try {
    if (plan.features) {
      currentPlanFeatures = JSON.parse(plan.features);
    }
  } catch {
    currentPlanFeatures = [];
  }

  return {
    plan: {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      price_monthly: plan.price_monthly,
      price_yearly: plan.price_yearly,
      max_workspaces: maxWorkspaces,
      max_users: plan.max_users,
      max_clients: plan.max_clients,
      max_sessions_per_month: maxSessionsMonthly,
      max_storage_mb: plan.max_storage_mb,
      features: currentPlanFeatures,
      is_active: plan.is_active,
    },
    subscription: subscription
      ? {
          id: subscription.id,
          status: subscription.status,
          gateway: subscription.gateway,
          current_period_start: subscription.current_period_start,
          current_period_end: subscription.current_period_end,
          cancel_at_period_end: subscription.cancel_at_period_end,
          cancel_at: subscription.cancel_at,
          canceled_at: subscription.canceled_at,
          payment_method_brand: subscription.payment_method_brand,
          payment_method_last4: subscription.payment_method_last4,
          payment_method_exp_month: subscription.payment_method_exp_month,
          payment_method_exp_year: subscription.payment_method_exp_year,
        }
      : null,
    usage: {
      workspaces: {
        current: workspacesCount,
        max: maxWorkspaces,
        percentage: workspacesPercentage,
        unlimited: workspacesUnlimited,
      },
      users: {
        current: usersCount,
        max: maxUsers,
        percentage: usersPercentage,
        unlimited: usersUnlimited,
      },
      clients: {
        current: clientsCount,
        max: maxClients,
        percentage: clientsPercentage,
        unlimited: clientsUnlimited,
      },
      sessions_monthly: {
        current: monthlySessionsCount,
        max: maxSessionsMonthly,
        percentage: sessionsPercentage,
        unlimited: sessionsUnlimited,
      },
    },
    team_billing: {
      price_per_user_monthly: teamPerUserMonthly,
      price_per_user_yearly: teamPerUserYearly,
      active_users: usersCount,
      pending_invites: pendingInvitesCount,
      total_seats: totalSeats,
      total_monthly: teamTotalMonthly,
      total_yearly: teamTotalYearly,
    },
    can_export_workspace: canExportWorkspace,
    can_create_client: canCreateClient,
    can_create_user: canCreateUser,
    can_create_session: canCreateSession,
    is_stripe_configured: isStripeConfigured(),
    available_plans: availablePlans,
  };
}

/**
 * Middleware to enforce plan limits on protected operations.
 */
export function checkPlanLimit(resource: 'clients' | 'users' | 'sessions', amount = 1) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId || req.user?.tenant_id;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant não identificado' });
      }

      const status = await getTenantBillingStatus(tenantId);

      if (resource === 'clients' && !status.can_create_client) {
        return res.status(403).json({
          error: `Limite de clientes atingido para o plano ${status.plan.name} (${status.usage.clients.current}/${status.usage.clients.max}). Faça upgrade para o plano Pro (R$ 9,99/mês) para ter clientes e sessões ilimitados.`,
          code: 'PLAN_LIMIT_EXCEEDED',
          resource: 'clients',
          current: status.usage.clients.current,
          max: status.usage.clients.max,
          plan: status.plan.id,
          upgrade_required: true,
        });
      }

      if (resource === 'sessions' && !status.can_create_session) {
        return res.status(403).json({
          error: `Limite mensal de 50 sessões atingido no plano ${status.plan.name} (${status.usage.sessions_monthly.current}/${status.usage.sessions_monthly.max}). Faça upgrade para o plano Pro (R$ 9,99/mês) para ter sessões e clientes ilimitados.`,
          code: 'PLAN_LIMIT_EXCEEDED',
          resource: 'sessions',
          current: status.usage.sessions_monthly.current,
          max: status.usage.sessions_monthly.max,
          plan: status.plan.id,
          upgrade_required: true,
        });
      }

      if (resource === 'users' && !status.can_create_user) {
        return res.status(403).json({
          error: `O plano ${status.plan.name} é de uso estritamente individual e não aceita membros adicionais. Faça upgrade para o plano Team (R$ 4,99/usuário/mês) para convidar colaboradores e gerenciar uma equipe no seu workspace.`,
          code: 'PLAN_LIMIT_EXCEEDED',
          resource: 'users',
          current: status.usage.users.current,
          max: status.usage.users.max,
          plan: status.plan.id,
          upgrade_required: true,
        });
      }

      next();
    } catch (err) {
      console.error('Error in checkPlanLimit middleware:', err);
      // Proceed gracefully to avoid blocking legitimate operations on error
      next();
    }
  };
}

/**
 * Daily limits of AI questions/messages per workspace based on tenant plan:
 * Free: 2 messages / day
 * Pro: 50 messages / day
 * Team: 1000 messages / day
 */
export const AI_WORKSPACE_DAILY_LIMITS: Record<string, number> = {
  free: 2,
  pro: 25,
  team: 100,
};

export function getAiDailyLimitForPlan(planId: string): number {
  if (planId in AI_WORKSPACE_DAILY_LIMITS) {
    return AI_WORKSPACE_DAILY_LIMITS[planId];
  }
  return planId === 'free' ? 2 : 25;
}

export interface WorkspaceAiDailyUsageInfo {
  workspace_id: string;
  tenant_id: string;
  date: string;
  current: number;
  max: number;
  remaining: number;
  plan_id: string;
  plan_name: string;
  is_limit_reached: boolean;
}

/**
 * Returns today's AI usage and limits for a specific workspace.
 */
export async function getWorkspaceAiDailyUsage(
  workspaceId: string,
  tenantId: string,
  dateStr?: string
): Promise<WorkspaceAiDailyUsageInfo> {
  const date = dateStr || new Date().toISOString().slice(0, 10);
  const record = await WorkspaceAiDailyUsage.findOne({
    where: { workspace_id: workspaceId, date },
  });
  const current = record ? record.count : 0;

  // Resolve plan
  const tenant = await Tenant.findByPk(tenantId, {
    include: [{ model: Plan, as: 'Plan' }],
  });
  const planId = tenant?.plan_id || tenant?.Plan?.id || 'free';
  const planName = tenant?.Plan?.name || (planId === 'team' ? 'Team' : planId === 'pro' ? 'Pro' : 'Free');
  const max = getAiDailyLimitForPlan(planId);
  const remaining = Math.max(0, max - current);

  return {
    workspace_id: workspaceId,
    tenant_id: tenantId,
    date,
    current,
    max,
    remaining,
    plan_id: planId,
    plan_name: planName,
    is_limit_reached: current >= max,
  };
}

/**
 * Increments today's AI message count for the workspace.
 */
export async function incrementWorkspaceAiDailyUsage(
  workspaceId: string,
  tenantId: string,
  dateStr?: string
): Promise<number> {
  const date = dateStr || new Date().toISOString().slice(0, 10);
  const [record] = await WorkspaceAiDailyUsage.findOrCreate({
    where: { workspace_id: workspaceId, date },
    defaults: {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      workspace_id: workspaceId,
      date,
      count: 0,
    },
  });

  await record.increment('count', { by: 1 });
  await record.reload();
  return record.count;
}

/**
 * Proxy-level middleware that restricts AI questions per workspace according to tenant plan:
 * Free: 2 / day
 * Pro: 50 / day
 * Team: 1000 / day
 */
export async function checkAiWorkspaceDailyLimit(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.tenantId || req.user?.tenant_id;
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant não identificado' });
    }

    // Resolve workspace ID
    let workspaceId = req.workspaceId;
    if (!workspaceId) {
      const ws = await Workspace.findOne({ where: { tenant_id: tenantId } });
      workspaceId = ws?.id;
    }

    if (!workspaceId) {
      return res.status(400).json({ error: 'Nenhum workspace ativo encontrado para o usuário' });
    }

    const usage = await getWorkspaceAiDailyUsage(workspaceId, tenantId);

    if (usage.is_limit_reached) {
      return res.status(429).json({
        error: `Limite diário de perguntas para a IA atingido para este workspace (${usage.current}/${usage.max} mensagens hoje no plano ${usage.plan_name}). Este limite é compartilhado entre todos os membros do workspace. Faça upgrade para o plano Pro (25 mensagens/dia) ou Team (100 mensagens/dia) para continuar.`,
        code: 'AI_DAILY_LIMIT_EXCEEDED',
        resource: 'ai_daily_messages',
        current: usage.current,
        max: usage.max,
        remaining: 0,
        plan: usage.plan_id,
        plan_name: usage.plan_name,
        workspace_id: workspaceId,
        upgrade_required: true,
      });
    }

    (req as any).aiWorkspaceUsage = usage;
    next();
  } catch (err) {
    console.error('Error in checkAiWorkspaceDailyLimit proxy middleware:', err);
    // Proceed gracefully if an unexpected lookup error occurs
    next();
  }
}
