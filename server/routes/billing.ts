import { Router, Request, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../auth';
import { getTenantBillingStatus } from '../billing';
import { Plan, Subscription, Tenant, User, Invoice, Invite } from '../db';
import { cacheGet, cacheSet, cacheDel } from '../cache';
import {
  getStripe,
  isStripeConfigured,
  createStripeCheckoutSession,
  createStripePortalSession,
  cancelStripeSubscription,
  reactivateStripeSubscription,
  syncSubscriptionWithStripe,
} from '../stripe';
import type Stripe from 'stripe';

export const billingRouter = Router();

// =========================================================================
// PUBLIC ROUTE: Stripe Webhook (Do NOT protect with authMiddleware)
// =========================================================================

/**
 * POST /api/billing/webhook
 * Receives real-time billing events from Stripe
 */
billingRouter.post('/webhook', async (req: Request, res: Response) => {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const sig = req.headers['stripe-signature'] as string | undefined;

  let event: Stripe.Event;

  try {
    const rawBody = (req as any).rawBody;

    if (stripe && webhookSecret && sig && rawBody) {
      // Signature verification via Stripe SDK
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } else {
      // Fallback for development, tests or simulation without webhook secret
      event = req.body;
      if (!event || !event.type) {
        return res.status(400).json({ error: 'Payload de evento inválido' });
      }
    }
  } catch (err: any) {
    console.error('⚠️ Falha na verificação de assinatura do Webhook Stripe:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`[Stripe Webhook] Evento recebido: ${event.type}`);

  try {
    switch (event.type) {
      // 1. Checkout finalizado com sucesso
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const tenantId = session.metadata?.tenant_id;
        const planId = session.metadata?.plan_id;
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
        const subscriptionId =
          typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

        if (tenantId && planId) {
          // Atualiza plano do Tenant
          const tenant = await Tenant.findByPk(tenantId);
          if (tenant) {
            tenant.plan_id = planId;
            await tenant.save();
          }

          // Atualiza ou cria assinatura local
          let subscription = await Subscription.findOne({ where: { tenant_id: tenantId } });
          const now = new Date();
          const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

          if (subscription) {
            subscription.plan_id = planId;
            subscription.status = 'active';
            subscription.gateway = 'stripe';
            subscription.gateway_customer_id = customerId || subscription.gateway_customer_id;
            subscription.gateway_subscription_id = subscriptionId || subscription.gateway_subscription_id;
            subscription.current_period_start = now;
            subscription.current_period_end = periodEnd;
            subscription.cancel_at_period_end = false;
            subscription.cancel_at = null;
            subscription.canceled_at = null;
            await subscription.save();
          } else {
            subscription = await Subscription.create({
              tenant_id: tenantId,
              plan_id: planId,
              status: 'active',
              gateway: 'stripe',
              gateway_customer_id: customerId || null,
              gateway_subscription_id: subscriptionId || null,
              current_period_start: now,
              current_period_end: periodEnd,
              cancel_at_period_end: false,
            });
          }

          // Busca dados do cartão se Stripe client estiver disponível
          if (stripe && subscriptionId) {
            try {
              const stripeSub = await stripe.subscriptions.retrieve(subscriptionId, {
                expand: ['default_payment_method'],
              });
              const pm = stripeSub.default_payment_method as Stripe.PaymentMethod | null;
              if (pm && pm.card) {
                subscription.payment_method_brand = pm.card.brand;
                subscription.payment_method_last4 = pm.card.last4;
                subscription.payment_method_exp_month = pm.card.exp_month;
                subscription.payment_method_exp_year = pm.card.exp_year;
                await subscription.save();
              }
            } catch (err) {
              console.warn('Não foi possível obter dados do cartão no checkout:', err);
            }
          }

          // Registra fatura correspondente
          const amountPaid = session.amount_total ? session.amount_total / 100 : (planId === 'pro' ? 4.99 : 9.90);
          await Invoice.create({
            tenant_id: tenantId,
            subscription_id: subscription.id,
            gateway_invoice_id: (session.invoice as string) || `inv_${session.id.slice(-8)}`,
            amount: amountPaid,
            currency: session.currency || 'brl',
            status: 'paid',
            billing_reason: 'subscription_create',
            paid_at: new Date(),
            period_start: now,
            period_end: periodEnd,
          });

          console.log(`[Stripe Webhook] Tenant ${tenantId} atualizado para plano ${planId}`);
        }
        break;
      }

      // 2. Fatura paga com sucesso (renovação de ciclo ou primeira cobrança)
      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
        const invSub = (invoice as any).subscription;
        const subscriptionId =
          typeof invSub === 'string' ? invSub : invSub?.id;

        // Localiza a assinatura pelo gateway_customer_id ou gateway_subscription_id
        let subscription: Subscription | null = null;
        if (subscriptionId) {
          subscription = await Subscription.findOne({ where: { gateway_subscription_id: subscriptionId } });
        }
        if (!subscription && customerId) {
          subscription = await Subscription.findOne({ where: { gateway_customer_id: customerId } });
        }

        if (subscription) {
          subscription.status = 'active';
          if (invoice.lines?.data?.[0]?.period) {
            const period = invoice.lines.data[0].period;
            subscription.current_period_start = new Date(period.start * 1000);
            subscription.current_period_end = new Date(period.end * 1000);
          }
          await subscription.save();

          // Cria ou atualiza registro de Invoice
          const existingInvoice = await Invoice.findOne({
            where: { gateway_invoice_id: invoice.id },
          });

          if (!existingInvoice) {
            await Invoice.create({
              tenant_id: subscription.tenant_id,
              subscription_id: subscription.id,
              gateway_invoice_id: invoice.id,
              amount: invoice.amount_paid ? invoice.amount_paid / 100 : 0,
              currency: invoice.currency || 'brl',
              status: 'paid',
              billing_reason: invoice.billing_reason || 'subscription_cycle',
              invoice_pdf: invoice.invoice_pdf || null,
              hosted_invoice_url: invoice.hosted_invoice_url || null,
              paid_at: new Date(),
              period_start: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
              period_end: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
            });
          }
        }
        break;
      }

      // 3. Falha de pagamento da fatura
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;

        if (customerId) {
          const subscription = await Subscription.findOne({ where: { gateway_customer_id: customerId } });
          if (subscription) {
            subscription.status = 'past_due';
            await subscription.save();

            await Invoice.create({
              tenant_id: subscription.tenant_id,
              subscription_id: subscription.id,
              gateway_invoice_id: invoice.id,
              amount: invoice.amount_due ? invoice.amount_due / 100 : 0,
              currency: invoice.currency || 'brl',
              status: 'failed',
              billing_reason: invoice.billing_reason || 'subscription_cycle',
              hosted_invoice_url: invoice.hosted_invoice_url || null,
              period_start: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
              period_end: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
            });
          }
        }
        break;
      }

      // 4. Assinatura atualizada no Stripe
      case 'customer.subscription.updated': {
        const stripeSub = event.data.object as Stripe.Subscription;
        const subscription = await Subscription.findOne({
          where: { gateway_subscription_id: stripeSub.id },
        });

        if (subscription) {
          subscription.status = stripeSub.status;
          subscription.cancel_at_period_end = stripeSub.cancel_at_period_end;
          subscription.cancel_at = stripeSub.cancel_at ? new Date(stripeSub.cancel_at * 1000) : null;
          subscription.canceled_at = stripeSub.canceled_at ? new Date(stripeSub.canceled_at * 1000) : null;
          if ((stripeSub as any).current_period_start) {
            subscription.current_period_start = new Date((stripeSub as any).current_period_start * 1000);
          }
          if ((stripeSub as any).current_period_end) {
            subscription.current_period_end = new Date((stripeSub as any).current_period_end * 1000);
          }
          await subscription.save();
        }
        break;
      }

      // 5. Assinatura cancelada definitivamente -> DOWNGRADE AUTOMÁTICO
      case 'customer.subscription.deleted': {
        const stripeSub = event.data.object as Stripe.Subscription;
        const subscription = await Subscription.findOne({
          where: { gateway_subscription_id: stripeSub.id },
        });

        if (subscription) {
          subscription.status = 'canceled';
          subscription.cancel_at_period_end = false;
          subscription.canceled_at = new Date();
          await subscription.save();

          // Downgrade automático no Tenant para o plano 'free'
          const tenant = await Tenant.findByPk(subscription.tenant_id);
          if (tenant) {
            tenant.plan_id = 'free';
            await tenant.save();
            console.log(`[Stripe Webhook] Downgrade automático aplicado: Tenant ${tenant.id} agora está no plano Free`);
          }
        }
        break;
      }

      default:
        console.log(`[Stripe Webhook] Evento não tratado: ${event.type}`);
    }

    await cacheDel('cronos:billing:status:*');

    return res.json({ received: true });
  } catch (err: any) {
    console.error('Erro ao processar webhook do Stripe:', err);
    return res.status(500).json({ error: 'Falha ao processar evento de webhook' });
  }
});

// =========================================================================
// PROTECTED ROUTES: require authenticated user & tenant
// =========================================================================
billingRouter.use(authMiddleware);

// GET /api/billing/status - Return current plan, subscription, usage vs limits
billingRouter.get('/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenantId || req.user?.tenant_id;
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant não autenticado' });
    }

    const cacheKey = `cronos:billing:status:${tenantId}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const billingStatus = await getTenantBillingStatus(tenantId);
    await cacheSet(cacheKey, billingStatus, 30);
    return res.json(billingStatus);
  } catch (err: any) {
    console.error('Error fetching billing status:', err);
    return res.status(500).json({ error: 'Erro ao consultar status do plano e faturamento' });
  }
});

// GET /api/billing/plans - List all available plans
billingRouter.get('/plans', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const plans = await Plan.findAll({
      where: { is_active: true },
      order: [['price_monthly', 'ASC']],
    });

    const formattedPlans = plans.map((p) => {
      let features: string[] = [];
      try {
        if (p.features) {
          features = JSON.parse(p.features);
        }
      } catch {
        features = [];
      }
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        price_monthly: p.price_monthly,
        price_yearly: p.price_yearly,
        max_users: p.max_users,
        max_clients: p.max_clients,
        max_storage_mb: p.max_storage_mb,
        features,
        is_active: p.is_active,
      };
    });

    return res.json({ plans: formattedPlans });
  } catch (err: any) {
    console.error('Error fetching plans:', err);
    return res.status(500).json({ error: 'Erro ao listar planos' });
  }
});

// GET /api/billing/invoices - List historical invoices for the tenant
billingRouter.get('/invoices', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenantId || req.user?.tenant_id;
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant não autenticado' });
    }

    let invoices = await Invoice.findAll({
      where: { tenant_id: tenantId },
      order: [['created_at', 'DESC']],
    });

    // Se não houver faturas e o workspace estiver em plano pago (ex: via teste inicial), gera fatura demonstrativa
    const tenant = await Tenant.findByPk(tenantId);
    if (invoices.length === 0 && tenant && tenant.plan_id !== 'free') {
      const plan = await Plan.findByPk(tenant.plan_id);
      const now = new Date();
      const demoInvoice = await Invoice.create({
        tenant_id: tenantId,
        amount: plan?.price_monthly || 29.0,
        currency: 'brl',
        status: 'paid',
        billing_reason: 'subscription_create',
        paid_at: now,
        period_start: now,
        period_end: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      });
      invoices = [demoInvoice];
    }

    return res.json({ invoices });
  } catch (err: any) {
    console.error('Error fetching invoices:', err);
    return res.status(500).json({ error: 'Erro ao buscar faturas' });
  }
});

// POST /api/billing/create-checkout-session - Create a Stripe Checkout session or simulated upgrade
billingRouter.post('/create-checkout-session', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenantId || req.user?.tenant_id;
    const userId = req.userId || req.user?.id;
    const user = req.user!;
    const tenant = req.tenant!;
    const { plan_id, interval = 'monthly' } = req.body;

    if (!tenantId || !userId) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    if (!plan_id || !['pro', 'team'].includes(plan_id)) {
      return res.status(400).json({ error: 'Selecione um plano pago válido (pro ou team).' });
    }

    const appUrl =
      process.env.APP_URL ||
      `${req.protocol}://${req.get('host')}` ||
      'http://localhost:3000';

    // Calculate total seats (active members + pending invites) in this workspace
    const usersCount = await User.count({ where: { tenant_id: tenantId } });
    const pendingInvitesCount = await Invite.count({
      where: { tenant_id: tenantId, status: 'pending' },
    });
    const totalSeats = Math.max(1, usersCount + pendingInvitesCount);

    if (isStripeConfigured()) {
      // Cria checkout real via Stripe Checkout
      const { sessionId, url } = await createStripeCheckoutSession({
        tenantId,
        tenantName: tenant.name || 'Workspace',
        userId,
        userEmail: user.email,
        userName: user.name || 'Usuário',
        planId: plan_id,
        interval: interval === 'yearly' ? 'yearly' : 'monthly',
        appUrl,
        seats: totalSeats,
      });

      return res.json({
        url,
        sessionId,
        mode: 'stripe',
      });
    } else {
      // Fallback em desenvolvimento/preview: simula o upgrade instantaneamente com dados de teste
      const targetPlan = await Plan.findByPk(plan_id);
      if (!targetPlan) {
        return res.status(404).json({ error: 'Plano não encontrado' });
      }

      tenant.plan_id = plan_id;
      await tenant.save();

      const now = new Date();
      const periodEnd = new Date(
        now.getTime() + (interval === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000
      );

      let subscription = await Subscription.findOne({ where: { tenant_id: tenantId } });
      if (subscription) {
        subscription.plan_id = plan_id;
        subscription.status = 'active';
        subscription.gateway = 'stripe_simulated';
        subscription.current_period_start = now;
        subscription.current_period_end = periodEnd;
        subscription.cancel_at_period_end = false;
        subscription.cancel_at = null;
        subscription.canceled_at = null;
        subscription.payment_method_brand = 'mastercard';
        subscription.payment_method_last4 = '4242';
        subscription.payment_method_exp_month = 12;
        subscription.payment_method_exp_year = 2028;
        await subscription.save();
      } else {
        subscription = await Subscription.create({
          tenant_id: tenantId,
          plan_id: plan_id,
          status: 'active',
          gateway: 'stripe_simulated',
          current_period_start: now,
          current_period_end: periodEnd,
          cancel_at_period_end: false,
          payment_method_brand: 'mastercard',
          payment_method_last4: '4242',
          payment_method_exp_month: 12,
          payment_method_exp_year: 2028,
        });
      }

      // Cria fatura correspondente (calculada com base no número de assentos para o plano Team)
      const baseUnitPrice = interval === 'yearly' ? targetPlan.price_yearly : targetPlan.price_monthly;
      const calculatedPrice =
        plan_id === 'team' ? Number((baseUnitPrice * totalSeats).toFixed(2)) : baseUnitPrice;

      await Invoice.create({
        tenant_id: tenantId,
        subscription_id: subscription.id,
        gateway_invoice_id: `inv_sim_${Date.now().toString().slice(-6)}`,
        amount: calculatedPrice,
        currency: 'brl',
        status: 'paid',
        billing_reason: 'subscription_create',
        paid_at: now,
        period_start: now,
        period_end: periodEnd,
      });

      await cacheDel('cronos:billing:status:*');
      const updatedStatus = await getTenantBillingStatus(tenantId);
      return res.json({
        url: null,
        mode: 'simulated',
        simulated: true,
        message: `Plano atualizado com sucesso para ${targetPlan.name} (Modo Simulação)!`,
        billing: updatedStatus,
      });
    }
  } catch (err: any) {
    console.error('Error creating checkout session:', err);
    return res.status(500).json({ error: err.message || 'Erro ao iniciar checkout de pagamento' });
  }
});

// POST /api/billing/customer-portal - Open Stripe Customer Portal
billingRouter.post('/customer-portal', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenantId || req.user?.tenant_id;
    if (!tenantId) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    const appUrl =
      process.env.APP_URL ||
      `${req.protocol}://${req.get('host')}` ||
      'http://localhost:3000';

    if (isStripeConfigured()) {
      const url = await createStripePortalSession({ tenantId, appUrl });
      return res.json({ url });
    } else {
      return res.json({
        url: null,
        simulated: true,
        message:
          'O Stripe Customer Portal requer a configuração de STRIPE_SECRET_KEY no ambiente. Em modo simulado, você pode gerenciar seu plano diretamente nesta tela.',
      });
    }
  } catch (err: any) {
    console.error('Error opening customer portal:', err);
    return res.status(500).json({ error: err.message || 'Erro ao abrir Portal de Assinatura do Stripe' });
  }
});

// POST /api/billing/cancel-subscription - Cancel active subscription
billingRouter.post('/cancel-subscription', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenantId || req.user?.tenant_id;
    const { immediately = false } = req.body;

    if (!tenantId) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    const result = await cancelStripeSubscription({
      tenantId,
      immediately: Boolean(immediately),
    });

    await cacheDel('cronos:billing:status:*');
    const updatedStatus = await getTenantBillingStatus(tenantId);
    return res.json({
      message: immediately
        ? 'Assinatura cancelada com sucesso. O plano foi rebaixado para o Free.'
        : 'Cancelamento agendado. Seu plano permanecerá ativo até o término do ciclo atual.',
      result,
      billing: updatedStatus,
    });
  } catch (err: any) {
    console.error('Error canceling subscription:', err);
    return res.status(500).json({ error: err.message || 'Erro ao cancelar assinatura' });
  }
});

// POST /api/billing/reactivate-subscription - Reactivate subscription before it expires
billingRouter.post('/reactivate-subscription', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenantId || req.user?.tenant_id;
    if (!tenantId) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    const result = await reactivateStripeSubscription({ tenantId });
    await cacheDel('cronos:billing:status:*');
    const updatedStatus = await getTenantBillingStatus(tenantId);

    return res.json({
      message: 'Assinatura reativada com sucesso! A renovação automática continuará ativa.',
      result,
      billing: updatedStatus,
    });
  } catch (err: any) {
    console.error('Error reactivating subscription:', err);
    return res.status(500).json({ error: err.message || 'Erro ao reativar assinatura' });
  }
});

// POST /api/billing/sync - Manually sync subscription with Stripe
billingRouter.post('/sync', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenantId || req.user?.tenant_id;
    if (!tenantId) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    await syncSubscriptionWithStripe(tenantId);
    await cacheDel('cronos:billing:status:*');
    const updatedStatus = await getTenantBillingStatus(tenantId);

    return res.json({
      message: 'Status de assinatura sincronizado com sucesso.',
      billing: updatedStatus,
    });
  } catch (err: any) {
    console.error('Error syncing billing:', err);
    return res.status(500).json({ error: 'Erro ao sincronizar com o Stripe' });
  }
});

// POST /api/billing/change-plan - Direct manual plan change (e.g. Free downgrade or testing)
billingRouter.post('/change-plan', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenantId || req.user?.tenant_id;
    const { plan_id, gateway } = req.body;

    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant não autenticado' });
    }

    if (!plan_id || !['free', 'pro', 'team'].includes(plan_id)) {
      return res.status(400).json({ error: 'Plano inválido selecionado' });
    }

    const targetPlan = await Plan.findByPk(plan_id);
    if (!targetPlan) {
      return res.status(404).json({ error: 'Plano não encontrado' });
    }

    // Update tenant plan_id
    const tenant = await Tenant.findByPk(tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant não encontrado' });
    }

    tenant.plan_id = plan_id;
    await tenant.save();

    // Update or create subscription
    let subscription = await Subscription.findOne({
      where: { tenant_id: tenantId },
      order: [['created_at', 'DESC']],
    });

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    if (subscription) {
      subscription.plan_id = plan_id;
      subscription.status = 'active';
      subscription.gateway = gateway || subscription.gateway || 'manual';
      subscription.current_period_start = now;
      subscription.current_period_end = periodEnd;
      subscription.cancel_at_period_end = false;
      subscription.cancel_at = null;
      subscription.canceled_at = null;
      await subscription.save();
    } else {
      subscription = await Subscription.create({
        tenant_id: tenantId,
        plan_id: plan_id,
        status: 'active',
        gateway: gateway || 'manual',
        current_period_start: now,
        current_period_end: periodEnd,
        cancel_at_period_end: false,
      });
    }

    await cacheDel('cronos:billing:status:*');
    const updatedStatus = await getTenantBillingStatus(tenantId);
    return res.json({
      message: `Plano alterado com sucesso para ${targetPlan.name}`,
      billing: updatedStatus,
    });
  } catch (err: any) {
    console.error('Error changing plan:', err);
    return res.status(500).json({ error: 'Erro ao alterar plano do workspace' });
  }
});

// POST /api/billing/simulate-webhook - Developer and test helper for webhook events
billingRouter.post('/simulate-webhook', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenantId || req.user?.tenant_id;
    const { event_type, plan_id = 'pro' } = req.body;

    if (!tenantId) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    const tenant = await Tenant.findByPk(tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado' });

    let subscription = await Subscription.findOne({ where: { tenant_id: tenantId } });

    if (event_type === 'checkout.session.completed' || event_type === 'invoice.paid') {
      tenant.plan_id = plan_id;
      await tenant.save();

      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      if (subscription) {
        subscription.plan_id = plan_id;
        subscription.status = 'active';
        subscription.gateway = 'stripe';
        subscription.cancel_at_period_end = false;
        subscription.current_period_start = now;
        subscription.current_period_end = periodEnd;
        subscription.payment_method_brand = 'visa';
        subscription.payment_method_last4 = '4242';
        subscription.payment_method_exp_month = 11;
        subscription.payment_method_exp_year = 2029;
        await subscription.save();
      }

      const simUsersCount = await User.count({ where: { tenant_id: tenantId } });
      const simPendingInvitesCount = await Invite.count({
        where: { tenant_id: tenantId, status: 'pending' },
      });
      const simTotalSeats = Math.max(1, simUsersCount + simPendingInvitesCount);
      const simCalculatedAmount =
        plan_id === 'team' ? Number((simTotalSeats * 9.90).toFixed(2)) : 4.99;

      await Invoice.create({
        tenant_id: tenantId,
        subscription_id: subscription?.id || null,
        gateway_invoice_id: `inv_sim_${Date.now().toString().slice(-6)}`,
        amount: simCalculatedAmount,
        currency: 'brl',
        status: 'paid',
        billing_reason: 'subscription_cycle',
        paid_at: now,
        period_start: now,
        period_end: periodEnd,
      });

      const updated = await getTenantBillingStatus(tenantId);
      return res.json({ message: `Simulação de ${event_type} processada!`, billing: updated });
    }

    if (event_type === 'customer.subscription.deleted') {
      // Downgrade automático
      tenant.plan_id = 'free';
      await tenant.save();

      if (subscription) {
        subscription.status = 'canceled';
        subscription.cancel_at_period_end = false;
        subscription.canceled_at = new Date();
        await subscription.save();
      }

      const updated = await getTenantBillingStatus(tenantId);
      return res.json({
        message: 'Simulação de customer.subscription.deleted processada com downgrade automático para Free!',
        billing: updated,
      });
    }

    return res.status(400).json({ error: `Tipo de evento de simulação não suportado: ${event_type}` });
  } catch (err: any) {
    console.error('Error simulating webhook:', err);
    return res.status(500).json({ error: 'Erro ao simular webhook' });
  }
});
