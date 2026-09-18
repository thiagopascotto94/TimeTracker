import fs from 'fs';
import path from 'path';
import { Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import { Plan, Subscription, Tenant, User, Client, TimeSession } from './db';
import { AuthenticatedRequest } from './auth';
import { isStripeConfigured } from './stripe';

export interface PlanLimitInfo {
  current: number;
  max: number;
  percentage: number;
  unlimited: boolean;
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
    storage_mb: PlanLimitInfo;
  };
  can_create_client: boolean;
  can_create_user: boolean;
  can_create_session: boolean;
  can_upload_storage: boolean;
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
    max_storage_mb: number;
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
  let storageMb = 0.5;
  try {
    const dbPath = path.resolve(process.cwd(), 'database.sqlite');
    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      storageMb = Number((stats.size / (1024 * 1024)).toFixed(2));
    }
  } catch (err) {
    console.warn('Could not read sqlite file size:', err);
  }

  const maxWorkspaces = plan.max_workspaces ?? 1;
  const maxUsers = plan.max_users ?? 1;
  const maxClients = plan.max_clients ?? 3;
  const maxSessionsMonthly = plan.max_sessions_per_month ?? -1;
  const maxStorage = plan.max_storage_mb ?? 500;

  const workspacesUnlimited = maxWorkspaces === -1;
  const usersUnlimited = maxUsers === -1;
  const clientsUnlimited = maxClients === -1;
  const sessionsUnlimited = maxSessionsMonthly === -1;
  const storageUnlimited = maxStorage === -1;

  const workspacesPercentage = workspacesUnlimited ? 0 : Math.min(100, Math.round((workspacesCount / maxWorkspaces) * 100));
  const usersPercentage = usersUnlimited ? 0 : Math.min(100, Math.round((usersCount / maxUsers) * 100));
  const clientsPercentage = clientsUnlimited ? 0 : Math.min(100, Math.round((clientsCount / maxClients) * 100));
  const sessionsPercentage = sessionsUnlimited ? 0 : Math.min(100, Math.round((monthlySessionsCount / maxSessionsMonthly) * 100));
  const storagePercentage = storageUnlimited ? 0 : Math.min(100, Math.round((storageMb / maxStorage) * 100));

  const canCreateUser = usersUnlimited || usersCount < maxUsers;
  const canCreateClient = clientsUnlimited || clientsCount < maxClients;
  const canCreateSession = sessionsUnlimited || monthlySessionsCount < maxSessionsMonthly;
  const canUploadStorage = storageUnlimited || storageMb < maxStorage;

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
      max_storage_mb: p.max_storage_mb,
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
      storage_mb: {
        current: storageMb,
        max: maxStorage,
        percentage: storagePercentage,
        unlimited: storageUnlimited,
      },
    },
    can_create_client: canCreateClient,
    can_create_user: canCreateUser,
    can_create_session: canCreateSession,
    can_upload_storage: canUploadStorage,
    is_stripe_configured: isStripeConfigured(),
    available_plans: availablePlans,
  };
}

/**
 * Middleware to enforce plan limits on protected operations.
 */
export function checkPlanLimit(resource: 'clients' | 'users' | 'storage' | 'sessions', amount = 1) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId || req.user?.tenant_id;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant não identificado' });
      }

      const status = await getTenantBillingStatus(tenantId);

      if (resource === 'clients' && !status.can_create_client) {
        return res.status(403).json({
          error: `Limite de clientes atingido para o plano ${status.plan.name} (${status.usage.clients.current}/${status.usage.clients.max}). Faça upgrade para o plano Pro (R$ 29/mês) para ter clientes e sessões ilimitados.`,
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
          error: `Limite mensal de 50 sessões atingido no plano ${status.plan.name} (${status.usage.sessions_monthly.current}/${status.usage.sessions_monthly.max}). Faça upgrade para o plano Pro (R$ 29/mês) para ter sessões e clientes ilimitados.`,
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
          error: `Limite de usuários atingido para o plano ${status.plan.name} (${status.usage.users.current}/${status.usage.users.max}). Faça upgrade para o plano Team (R$ 79/mês) para adicionar mais membros.`,
          code: 'PLAN_LIMIT_EXCEEDED',
          resource: 'users',
          current: status.usage.users.current,
          max: status.usage.users.max,
          plan: status.plan.id,
          upgrade_required: true,
        });
      }

      if (resource === 'storage' && !status.can_upload_storage) {
        return res.status(403).json({
          error: `Limite de armazenamento atingido para o plano ${status.plan.name} (${status.usage.storage_mb.current}MB/${status.usage.storage_mb.max}MB). Faça upgrade de plano para expandir o armazenamento.`,
          code: 'PLAN_LIMIT_EXCEEDED',
          resource: 'storage',
          current: status.usage.storage_mb.current,
          max: status.usage.storage_mb.max,
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
