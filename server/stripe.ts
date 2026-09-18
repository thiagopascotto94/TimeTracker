import Stripe from 'stripe';
import { Subscription, Tenant, Plan, Invoice } from './db';

let stripeClient: Stripe | null = null;

/**
 * Retorna se as credenciais do Stripe estão configuradas no ambiente
 */
export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.trim().length > 0;
}

/**
 * Inicialização segura e sob demanda (lazy initialization) do cliente Stripe
 */
export function getStripe(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    return null;
  }
  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: '2025-02-24.acacia' as any,
      typescript: true,
      appInfo: {
        name: 'Cronos Time & Billing',
        version: '2.0.0',
      },
    });
  }
  return stripeClient;
}

export interface PlanPricingInfo {
  id: string;
  name: string;
  monthlyAmount: number; // in BRL cents
  yearlyAmount: number; // in BRL cents
  priceIdMonthly?: string;
  priceIdYearly?: string;
}

export const PLAN_PRICING: Record<string, PlanPricingInfo> = {
  pro: {
    id: 'pro',
    name: 'Cronos Pro',
    monthlyAmount: 2900, // R$ 29,00
    yearlyAmount: 29000, // R$ 290,00
    priceIdMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
    priceIdYearly: process.env.STRIPE_PRICE_PRO_YEARLY,
  },
  team: {
    id: 'team',
    name: 'Cronos Team',
    monthlyAmount: 7900, // R$ 79,00
    yearlyAmount: 79000, // R$ 790,00
    priceIdMonthly: process.env.STRIPE_PRICE_TEAM_MONTHLY,
    priceIdYearly: process.env.STRIPE_PRICE_TEAM_YEARLY,
  },
};

/**
 * Busca ou cria um Customer no Stripe vinculado ao Tenant e usuário
 */
export async function getOrCreateStripeCustomer(params: {
  tenantId: string;
  tenantName: string;
  userEmail: string;
  userName: string;
}): Promise<string> {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error('Chave secreta do Stripe (STRIPE_SECRET_KEY) não configurada.');
  }

  // Verifica se o tenant já possui gateway_customer_id salvo
  const currentSub = await Subscription.findOne({
    where: { tenant_id: params.tenantId },
  });

  if (currentSub?.gateway_customer_id) {
    try {
      const existing = await stripe.customers.retrieve(currentSub.gateway_customer_id);
      if (!existing.deleted) {
        return existing.id;
      }
    } catch (err) {
      console.warn(`Customer ${currentSub.gateway_customer_id} não encontrado no Stripe, criando novo.`);
    }
  }

  // Busca se já existe um customer com o mesmo email e metadata tenant_id
  const search = await stripe.customers.search({
    query: `metadata['tenant_id']:'${params.tenantId}'`,
    limit: 1,
  }).catch(() => null);

  if (search && search.data.length > 0) {
    const customerId = search.data[0].id;
    if (currentSub) {
      currentSub.gateway_customer_id = customerId;
      await currentSub.save();
    }
    return customerId;
  }

  // Cria novo Customer
  const customer = await stripe.customers.create({
    email: params.userEmail,
    name: `${params.userName} (${params.tenantName})`,
    metadata: {
      tenant_id: params.tenantId,
      workspace: params.tenantName,
    },
  });

  if (currentSub) {
    currentSub.gateway_customer_id = customer.id;
    await currentSub.save();
  }

  return customer.id;
}

/**
 * Cria uma Checkout Session do Stripe para assinatura recorrente
 */
export async function createStripeCheckoutSession(params: {
  tenantId: string;
  tenantName: string;
  userId: string;
  userEmail: string;
  userName: string;
  planId: 'pro' | 'team';
  interval: 'monthly' | 'yearly';
  appUrl: string;
}): Promise<{ sessionId: string; url: string }> {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error('STRIPE_SECRET_KEY não está configurada no ambiente.');
  }

  const pricing = PLAN_PRICING[params.planId];
  if (!pricing) {
    throw new Error(`Plano inválido: ${params.planId}`);
  }

  const customerId = await getOrCreateStripeCustomer({
    tenantId: params.tenantId,
    tenantName: params.tenantName,
    userEmail: params.userEmail,
    userName: params.userName,
  });

  const priceId = params.interval === 'yearly' ? pricing.priceIdYearly : pricing.priceIdMonthly;

  let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];

  if (priceId && priceId.trim()) {
    lineItems = [{ price: priceId.trim(), quantity: 1 }];
  } else {
    // Criação dinâmica de preço no Stripe (não exige configuração prévia no dashboard)
    const unitAmount = params.interval === 'yearly' ? pricing.yearlyAmount : pricing.monthlyAmount;
    const intervalName = params.interval === 'yearly' ? 'year' : 'month';

    lineItems = [
      {
        price_data: {
          currency: 'brl',
          product_data: {
            name: `${pricing.name} (${params.interval === 'yearly' ? 'Anual' : 'Mensal'})`,
            description: `Assinatura recorrente ${params.interval === 'yearly' ? 'anual' : 'mensal'} do plano ${pricing.name}`,
          },
          unit_amount: unitAmount,
          recurring: {
            interval: intervalName,
          },
        },
        quantity: 1,
      },
    ];
  }

  const baseUrl = params.appUrl.replace(/\/$/, '');
  const successUrl = `${baseUrl}/?billing_success=true&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${baseUrl}/?billing_canceled=true`;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    payment_method_types: ['card'],
    line_items: lineItems,
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    metadata: {
      tenant_id: params.tenantId,
      user_id: params.userId,
      plan_id: params.planId,
      interval: params.interval,
    },
    subscription_data: {
      metadata: {
        tenant_id: params.tenantId,
        user_id: params.userId,
        plan_id: params.planId,
        interval: params.interval,
      },
    },
  });

  if (!session.url) {
    throw new Error('Falha ao obter URL da sessão do Stripe Checkout.');
  }

  return {
    sessionId: session.id,
    url: session.url,
  };
}

/**
 * Cria sessão no Stripe Customer Portal para gerenciamento de cartão e faturas
 */
export async function createStripePortalSession(params: {
  tenantId: string;
  appUrl: string;
}): Promise<string> {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error('STRIPE_SECRET_KEY não está configurada no ambiente.');
  }

  const subscription = await Subscription.findOne({
    where: { tenant_id: params.tenantId },
  });

  if (!subscription?.gateway_customer_id) {
    throw new Error('Nenhum cliente registrado no Stripe para este workspace.');
  }

  const baseUrl = params.appUrl.replace(/\/$/, '');
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: subscription.gateway_customer_id,
    return_url: `${baseUrl}/?tab=billing`,
  });

  return portalSession.url;
}

/**
 * Cancela uma assinatura no Stripe (imediatamente ou no fim do ciclo pago)
 */
export async function cancelStripeSubscription(params: {
  tenantId: string;
  immediately?: boolean;
}): Promise<{ status: string; cancel_at_period_end: boolean; current_period_end: Date }> {
  const stripe = getStripe();
  const subscription = await Subscription.findOne({
    where: { tenant_id: params.tenantId },
  });

  if (!subscription) {
    throw new Error('Assinatura não encontrada para este workspace.');
  }

  const now = new Date();

  // Se estiver em modo manual ou simulado (sem Stripe ou sem ID de gateway)
  if (!stripe || !subscription.gateway_subscription_id) {
    if (params.immediately) {
      subscription.status = 'canceled';
      subscription.cancel_at_period_end = false;
      subscription.canceled_at = now;
      await subscription.save();

      // Downgrade automático para plano Free
      const tenant = await Tenant.findByPk(params.tenantId);
      if (tenant) {
        tenant.plan_id = 'free';
        await tenant.save();
      }
    } else {
      subscription.cancel_at_period_end = true;
      subscription.cancel_at = subscription.current_period_end;
      await subscription.save();
    }

    return {
      status: subscription.status,
      cancel_at_period_end: subscription.cancel_at_period_end,
      current_period_end: subscription.current_period_end,
    };
  }

  // Com Stripe ativo
  if (params.immediately) {
    const canceledStripeSub = await stripe.subscriptions.cancel(subscription.gateway_subscription_id);
    subscription.status = 'canceled';
    subscription.cancel_at_period_end = false;
    subscription.canceled_at = new Date((canceledStripeSub.canceled_at || Math.floor(Date.now() / 1000)) * 1000);
    await subscription.save();

    // Downgrade automático no tenant
    const tenant = await Tenant.findByPk(params.tenantId);
    if (tenant) {
      tenant.plan_id = 'free';
      await tenant.save();
    }

    return {
      status: 'canceled',
      cancel_at_period_end: false,
      current_period_end: subscription.current_period_end,
    };
  } else {
    const updatedStripeSub = await stripe.subscriptions.update(subscription.gateway_subscription_id, {
      cancel_at_period_end: true,
    });

    const periodEndSeconds = (updatedStripeSub as any).current_period_end;
    const periodEndDate = periodEndSeconds ? new Date(periodEndSeconds * 1000) : subscription.current_period_end;

    subscription.cancel_at_period_end = true;
    subscription.cancel_at = periodEndDate;
    await subscription.save();

    return {
      status: subscription.status,
      cancel_at_period_end: true,
      current_period_end: periodEndDate,
    };
  }
}

/**
 * Reativa assinatura que estava marcada para cancelar no fim do período
 */
export async function reactivateStripeSubscription(params: {
  tenantId: string;
}): Promise<{ status: string; cancel_at_period_end: boolean }> {
  const stripe = getStripe();
  const subscription = await Subscription.findOne({
    where: { tenant_id: params.tenantId },
  });

  if (!subscription) {
    throw new Error('Assinatura não encontrada.');
  }

  if (stripe && subscription.gateway_subscription_id) {
    await stripe.subscriptions.update(subscription.gateway_subscription_id, {
      cancel_at_period_end: false,
    });
  }

  subscription.cancel_at_period_end = false;
  subscription.cancel_at = null;
  subscription.status = 'active';
  await subscription.save();

  return {
    status: subscription.status,
    cancel_at_period_end: false,
  };
}

/**
 * Sincroniza o estado atual da assinatura com os dados do Stripe
 */
export async function syncSubscriptionWithStripe(tenantId: string): Promise<Subscription | null> {
  const stripe = getStripe();
  const subscription = await Subscription.findOne({
    where: { tenant_id: tenantId },
  });

  if (!subscription) return null;

  if (!stripe || !subscription.gateway_subscription_id) {
    return subscription;
  }

  try {
    const stripeSub = await stripe.subscriptions.retrieve(subscription.gateway_subscription_id, {
      expand: ['default_payment_method', 'latest_invoice'],
    });

    subscription.status = stripeSub.status;
    if ((stripeSub as any).current_period_start) {
      subscription.current_period_start = new Date((stripeSub as any).current_period_start * 1000);
    }
    if ((stripeSub as any).current_period_end) {
      subscription.current_period_end = new Date((stripeSub as any).current_period_end * 1000);
    }
    subscription.cancel_at_period_end = stripeSub.cancel_at_period_end;
    subscription.cancel_at = stripeSub.cancel_at ? new Date(stripeSub.cancel_at * 1000) : null;
    subscription.canceled_at = stripeSub.canceled_at ? new Date(stripeSub.canceled_at * 1000) : null;

    // Se payment_method foi expandido, extrai dados do cartão
    const pm = stripeSub.default_payment_method as Stripe.PaymentMethod | null;
    if (pm && pm.card) {
      subscription.payment_method_brand = pm.card.brand;
      subscription.payment_method_last4 = pm.card.last4;
      subscription.payment_method_exp_month = pm.card.exp_month;
      subscription.payment_method_exp_year = pm.card.exp_year;
    }

    // Se o status for cancelado, aplica downgrade automático no tenant
    if (stripeSub.status === 'canceled' || stripeSub.status === 'unpaid') {
      const tenant = await Tenant.findByPk(tenantId);
      if (tenant && tenant.plan_id !== 'free') {
        tenant.plan_id = 'free';
        await tenant.save();
      }
    }

    await subscription.save();
    return subscription;
  } catch (err) {
    console.error('Erro ao sincronizar assinatura com Stripe:', err);
    return subscription;
  }
}
