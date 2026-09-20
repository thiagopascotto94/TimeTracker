import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Check,
  AlertTriangle,
  Users,
  Briefcase,
  HardDrive,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Calendar,
  RefreshCw,
  ExternalLink,
  Receipt,
  FileText,
  AlertCircle,
  Clock,
  RotateCcw,
  Zap,
  BookOpen,
  Layers,
  Bot,
  Download,
  FileJson,
  Lock,
  Loader2,
} from 'lucide-react';
import { BillingStatus, Plan, InvoiceItem } from '../types';
import { apiFetch } from '../utils/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Dialog } from './ui/dialog';
import { useToast } from './ui/toast';
import { formatCurrency } from '../utils/format';
import { BillingGuideModal } from './BillingGuideModal';

interface BillingSettingsTabProps {
  onPlanChanged?: () => void;
}

export const BillingSettingsTab: React.FC<BillingSettingsTabProps> = ({ onPlanChanged }) => {
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingInvoices, setLoadingInvoices] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [updatingPlan, setUpdatingPlan] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');

  // Cancel modal states
  const [cancelModalOpen, setCancelModalOpen] = useState<boolean>(false);
  const [canceling, setCanceling] = useState<boolean>(false);
  const [cancelImmediately, setCancelImmediately] = useState<boolean>(false);

  // Guide modal state
  const [guideModalOpen, setGuideModalOpen] = useState<boolean>(false);

  // Portal loading
  const [loadingPortal, setLoadingPortal] = useState<boolean>(false);

  // Dev simulation tool state
  const [simulatingWebhook, setSimulatingWebhook] = useState<boolean>(false);

  // Workspace export state
  const [exportingWorkspace, setExportingWorkspace] = useState<boolean>(false);

  const { addToast } = useToast();

  const handleExportWorkspace = async () => {
    try {
      setExportingWorkspace(true);
      const res = await apiFetch('/api/workspaces/export');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao exportar dados do workspace');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cronos-workspace-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      addToast({
        title: 'Exportação Concluída!',
        description: 'Backup completo de todos os dados do workspace baixado com sucesso em formato JSON.',
        variant: 'success',
      });
    } catch (err: any) {
      addToast({
        title: 'Falha na Exportação',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setExportingWorkspace(false);
    }
  };

  const fetchBillingStatus = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/billing/status');
      if (!res.ok) throw new Error('Falha ao obter status de faturamento');
      const data: BillingStatus = await res.json();
      setBilling(data);
    } catch (err: any) {
      console.error('Error loading billing status:', err);
      addToast({
        title: 'Erro ao carregar faturamento',
        description: err.message || 'Não foi possível carregar os dados de limites e plano.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoices = async () => {
    try {
      setLoadingInvoices(true);
      const res = await apiFetch('/api/billing/invoices');
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.invoices || []);
      }
    } catch (err) {
      console.error('Error loading invoices:', err);
    } finally {
      setLoadingInvoices(false);
    }
  };

  useEffect(() => {
    fetchBillingStatus();
    fetchInvoices();

    // Verifica parâmetros de retorno de checkout do Stripe na URL
    const params = new URLSearchParams(window.location.search);
    if (params.get('billing_success') === 'true') {
      addToast({
        title: 'Assinatura realizada com sucesso!',
        description: 'Seu pagamento foi confirmado pelo Stripe e seu novo plano está ativo.',
        variant: 'default',
      });
      // Limpa os parâmetros da URL sem recarregar
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', newUrl);
    } else if (params.get('billing_canceled') === 'true') {
      addToast({
        title: 'Checkout cancelado',
        description: 'O processo de pagamento foi interrompido. Nenhuma cobrança foi realizada.',
        variant: 'destructive',
      });
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  // Sincroniza dados com Stripe
  const handleSyncStripe = async () => {
    try {
      setSyncing(true);
      const res = await apiFetch('/api/billing/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao sincronizar');

      setBilling(data.billing);
      await fetchInvoices();
      addToast({
        title: 'Sincronização concluída',
        description: data.message || 'Dados de assinatura sincronizados com o Stripe.',
        variant: 'default',
      });
    } catch (err: any) {
      addToast({
        title: 'Erro na sincronização',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  // Iniciar Stripe Checkout ou Upgrade de Plano
  const handleSelectPlan = async (targetPlanId: string) => {
    if (billing?.plan.id === targetPlanId) return;

    if (targetPlanId === 'free') {
      // Abre modal de cancelamento/downgrade para Free
      setCancelModalOpen(true);
      return;
    }

    try {
      setUpdatingPlan(targetPlanId);
      const res = await apiFetch('/api/billing/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: targetPlanId,
          interval: billingInterval,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao iniciar contratação');

      if (data.url) {
        // Redireciona para o checkout do Stripe
        window.location.href = data.url;
      } else if (data.simulated) {
        // Modo simulação em ambiente sem chaves do Stripe
        addToast({
          title: 'Upgrade realizado com sucesso!',
          description: (data.message || `Plano ${targetPlanId.toUpperCase()} ativado.`) + ' Atualizando sistema...',
          variant: 'default',
        });
        setBilling(data.billing);
        await fetchInvoices();
        if (onPlanChanged) onPlanChanged();
        setTimeout(() => window.location.reload(), 1200);
      }
    } catch (err: any) {
      console.error('Error initiating plan switch:', err);
      addToast({
        title: 'Erro ao alterar plano',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setUpdatingPlan(null);
    }
  };

  // Abrir Stripe Customer Portal (gerenciamento de cartão e faturas externas)
  const handleOpenCustomerPortal = async () => {
    try {
      setLoadingPortal(true);
      const res = await apiFetch('/api/billing/customer-portal', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao abrir portal');

      if (data.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
      } else {
        addToast({
          title: 'Portal do Cliente Stripe',
          description:
            data.message || 'Configure a chave STRIPE_SECRET_KEY para acessar o Portal do Stripe.',
          variant: 'default',
        });
      }
    } catch (err: any) {
      addToast({
        title: 'Erro ao abrir portal',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoadingPortal(false);
    }
  };

  // Cancelar assinatura
  const handleCancelSubscription = async () => {
    try {
      setCanceling(true);
      const res = await apiFetch('/api/billing/cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ immediately: cancelImmediately }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao cancelar assinatura');

      addToast({
        title: 'Assinatura cancelada',
        description: (data.message || '') + ' Atualizando sistema...',
        variant: 'default',
      });

      setBilling(data.billing);
      setCancelModalOpen(false);
      await fetchInvoices();
      if (onPlanChanged) onPlanChanged();
      setTimeout(() => window.location.reload(), 1200);
    } catch (err: any) {
      addToast({
        title: 'Erro no cancelamento',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setCanceling(false);
    }
  };

  // Reativar assinatura antes do fim do período
  const handleReactivateSubscription = async () => {
    try {
      setCanceling(true);
      const res = await apiFetch('/api/billing/reactivate-subscription', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao reativar assinatura');

      addToast({
        title: 'Assinatura reativada!',
        description: (data.message || 'Sua assinatura continuará renovando automaticamente.') + ' Atualizando sistema...',
        variant: 'default',
      });

      setBilling(data.billing);
      if (onPlanChanged) onPlanChanged();
      setTimeout(() => window.location.reload(), 1200);
    } catch (err: any) {
      addToast({
        title: 'Erro ao reativar',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setCanceling(false);
    }
  };

  // Simular evento de webhook (ferramenta de teste para desenvolvedores)
  const handleSimulateWebhook = async (eventType: string, planId = 'pro') => {
    try {
      setSimulatingWebhook(true);
      const res = await apiFetch('/api/billing/simulate-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type: eventType, plan_id: planId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      addToast({
        title: 'Evento de Webhook Simulado',
        description: (data.message || '') + ' Atualizando sistema...',
        variant: 'default',
      });

      setBilling(data.billing);
      await fetchInvoices();
      if (onPlanChanged) onPlanChanged();
      setTimeout(() => window.location.reload(), 1200);
    } catch (err: any) {
      addToast({
        title: 'Falha na simulação',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSimulatingWebhook(false);
    }
  };

  if (loading && !billing) {
    return (
      <div className="p-12 text-center bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-600 dark:text-indigo-400 mb-3" />
        <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
          Carregando status do plano e faturamento...
        </p>
      </div>
    );
  }

  if (!billing) {
    return (
      <div className="p-8 text-center bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p className="text-sm text-red-600 font-medium">Não foi possível carregar as informações do faturamento.</p>
        <Button onClick={fetchBillingStatus} variant="outline" className="mt-4 text-xs">
          Tentar novamente
        </Button>
      </div>
    );
  }

  const { plan, subscription, usage, available_plans, is_stripe_configured } = billing;

  const isFreePlan = plan.id === 'free';
  const isCancelingAtPeriodEnd = subscription?.cancel_at_period_end;
  const isPastDue = subscription?.status === 'past_due';

  const formattedPeriodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <div className="space-y-6">
      {/* Top Notification Banner if Past Due or Canceling */}
      {isPastDue && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <h4 className="font-bold text-red-900 dark:text-red-200 text-sm">Pagamento Pendente (Past Due)</h4>
            <p className="text-red-700 dark:text-red-300">
              Houve uma falha na renovação da sua fatura no Stripe. Por favor, atualize os dados do seu cartão de crédito para evitar a interrupção dos recursos do plano {plan.name}.
            </p>
            <div className="pt-2">
              <Button
                onClick={handleOpenCustomerPortal}
                size="sm"
                className="text-xs bg-red-600 hover:bg-red-700 text-white"
              >
                <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                <span>Regularizar Pagamento no Stripe</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {isCancelingAtPeriodEnd && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 text-xs">
            <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-bold text-amber-900 dark:text-amber-200 text-sm">
                Cancelamento de Assinatura Agendado
              </h4>
              <p className="text-amber-800 dark:text-amber-300">
                Seu plano <span className="font-semibold">{plan.name}</span> permanecerá ativo até{' '}
                <span className="font-semibold">{formattedPeriodEnd}</span>. Após essa data, seu workspace será rebaixado automaticamente para o plano Free.
              </p>
            </div>
          </div>
          <Button
            onClick={handleReactivateSubscription}
            disabled={canceling}
            size="sm"
            className="text-xs bg-amber-600 hover:bg-amber-700 text-white shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            <span>Reativar Plano</span>
          </Button>
        </div>
      )}

      {/* Overview Grid: Current Plan & Payment Method */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Card 1: Active Plan Summary */}
        <Card className="lg:col-span-2 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
          <CardHeader className="pb-4 border-b border-neutral-100 dark:border-neutral-800">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                    Plano Ativo do Workspace
                  </CardTitle>
                  <Badge
                    className={`text-2xs font-bold uppercase tracking-wider ${
                      isFreePlan
                        ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                        : isCancelingAtPeriodEnd
                        ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                        : isPastDue
                        ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                        : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    {isCancelingAtPeriodEnd ? 'Cancelamento Agendado' : isPastDue ? 'Pendente' : 'Ativo'}
                  </Badge>
                </div>
                <CardDescription className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Gerencie sua assinatura e cobranças recorrentes com segurança
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                {import.meta.env.DEV && (
                  <Button
                    onClick={() => setGuideModalOpen(true)}
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 cursor-pointer bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-neutral-700 border-indigo-200 dark:border-indigo-900/50"
                    title="Ver documentação completa das Fases 1 e 2"
                  >
                    <BookOpen className="w-3.5 h-3.5 mr-1.5" />
                    <span>Manual Fase 1 & 2</span>
                  </Button>
                )}

                <Button
                  onClick={handleSyncStripe}
                  disabled={syncing}
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 cursor-pointer"
                  title="Sincronizar status com Stripe"
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
                  <span>Sincronizar</span>
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-950/50 border border-neutral-200 dark:border-neutral-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-lg font-extrabold text-neutral-900 dark:text-neutral-100">
                    Plano {plan.name}
                  </span>
                  <span className="text-sm font-semibold text-neutral-500">
                    • {plan.price_monthly === 0
                      ? 'Gratuito'
                      : plan.id === 'team'
                      ? `${formatCurrency(plan.price_monthly)}/usuário/mês`
                      : `${formatCurrency(plan.price_monthly)}/mês`}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {plan.id === 'pro'
                    ? 'Plano individual (1 usuário) com IA ilimitada e exportação de dados completa.'
                    : plan.id === 'team'
                    ? 'Plano de equipe com cobrança por assento, convites ilimitados e exportação de dados.'
                    : (plan.description || 'Acesso completo às ferramentas de faturamento e cronômetro.')}
                </p>

                {formattedPeriodEnd && !isFreePlan && (
                  <p className="text-2xs text-neutral-400 flex items-center gap-1 mt-2">
                    <Calendar className="w-3 h-3 text-neutral-400" />
                    <span>
                      {isCancelingAtPeriodEnd ? 'Término do período contratado em: ' : 'Próxima renovação automática: '}
                      <strong className="text-neutral-700 dark:text-neutral-300">{formattedPeriodEnd}</strong>
                    </span>
                  </p>
                )}
              </div>

              {!isFreePlan && (
                <div className="shrink-0 flex items-center gap-2">
                  {isCancelingAtPeriodEnd ? (
                    <Button
                      onClick={handleReactivateSubscription}
                      disabled={canceling}
                      size="sm"
                      className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                      <span>Reativar Assinatura</span>
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setCancelModalOpen(true)}
                      variant="outline"
                      size="sm"
                      className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-900/60 cursor-pointer"
                    >
                      <span>Cancelar Assinatura</span>
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Usage vs Limits mini-bars */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Clients */}
              <div className="p-3 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-neutral-600 dark:text-neutral-400 font-medium flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Clientes</span>
                  </span>
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                    {usage.clients.current} / {usage.clients.unlimited ? '∞' : usage.clients.max}
                  </span>
                </div>
                <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      usage.clients.percentage >= 100 ? 'bg-amber-500' : 'bg-indigo-600'
                    }`}
                    style={{ width: `${Math.min(100, usage.clients.percentage)}%` }}
                  />
                </div>
              </div>

              {/* Sessions Monthly */}
              <div className="p-3 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-neutral-600 dark:text-neutral-400 font-medium flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Sessões / mês</span>
                  </span>
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                    {usage.sessions_monthly?.current ?? 0} / {usage.sessions_monthly?.unlimited ? '∞' : (usage.sessions_monthly?.max ?? 50)}
                  </span>
                </div>
                <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      (usage.sessions_monthly?.percentage ?? 0) >= 100 ? 'bg-amber-500' : 'bg-indigo-600'
                    }`}
                    style={{ width: `${Math.min(100, usage.sessions_monthly?.percentage ?? 0)}%` }}
                  />
                </div>
              </div>

              {/* Workspaces */}
              <div className="p-3 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-neutral-600 dark:text-neutral-400 font-medium flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Workspaces</span>
                  </span>
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                    {usage.workspaces?.current ?? 1} / {usage.workspaces?.unlimited ? '∞' : (usage.workspaces?.max ?? 1)}
                  </span>
                </div>
                <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      (usage.workspaces?.percentage ?? 0) >= 100 ? 'bg-amber-500' : 'bg-indigo-600'
                    }`}
                    style={{ width: `${Math.min(100, usage.workspaces?.percentage ?? 0)}%` }}
                  />
                </div>
              </div>

              {/* Users */}
              <div className="p-3 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-neutral-600 dark:text-neutral-400 font-medium flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Membros</span>
                  </span>
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                    {usage.users.current} / {usage.users.unlimited ? '∞' : usage.users.max}
                  </span>
                </div>
                <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      usage.users.percentage >= 100 ? 'bg-amber-500' : 'bg-indigo-600'
                    }`}
                    style={{ width: `${Math.min(100, usage.users.percentage)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Team Billing calculation breakdown if on Team plan or has team_billing */}
            {billing?.team_billing && (
              <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <div className="font-semibold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Faturamento do Plano Team por Assento</span>
                  </div>
                  <p className="text-2xs text-indigo-700 dark:text-indigo-300">
                    {billing.team_billing.active_users} membro(s) ativo(s) + {billing.team_billing.pending_invites} convite(s) pendente(s) = <strong>{billing.team_billing.total_seats} assento(s)</strong> no workspace.
                  </p>
                </div>
                <div className="sm:text-right">
                  <span className="text-sm font-bold text-indigo-900 dark:text-indigo-100">
                    {formatCurrency(billing.team_billing.price_per_user_monthly)} / usuário / mês
                  </span>
                  <div className="text-2xs text-indigo-600 dark:text-indigo-400 font-medium">
                    Total mensal calculado: {formatCurrency(billing.team_billing.total_seats * billing.team_billing.price_per_user_monthly)}/mês
                  </div>
                </div>
              </div>
            )}

            {/* Workspace Data Export row */}
            <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                  <FileJson className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Backup &amp; Exportação Completa do Workspace</span>
                  {billing?.can_export_workspace ? (
                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-0 text-3xs font-semibold">
                      Incluso no seu plano
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-0 text-3xs font-semibold flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" />
                      <span>Pro &amp; Team</span>
                    </Badge>
                  )}
                </div>
                <p className="text-2xs text-neutral-500 dark:text-neutral-400">
                  Gera um arquivo JSON completo com clientes, sessões registradas, metas, faturas e membros.
                </p>
              </div>

              {billing?.can_export_workspace ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleExportWorkspace}
                  disabled={exportingWorkspace}
                  className="shrink-0 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer shadow-xs gap-1.5"
                >
                  {exportingWorkspace ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Exportando...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Exportar Workspace (.json)</span>
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const plansEl = document.getElementById('pricing-plans-section');
                    if (plansEl) plansEl.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="shrink-0 text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
                >
                  <span>Upgrade para Exportar</span>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Payment Method & Stripe Card Management */}
        <Card className="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-neutral-100 dark:border-neutral-800">
            <CardTitle className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Cartão & Pagamento</span>
            </CardTitle>
            <CardDescription className="text-xs text-neutral-500 dark:text-neutral-400">
              Método de cobrança para renovações automáticas
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4 flex-1 flex flex-col justify-between space-y-4">
            {subscription?.payment_method_last4 ? (
              <div className="p-4 rounded-xl bg-gradient-to-br from-neutral-900 to-neutral-800 text-white shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-2xs uppercase tracking-widest text-neutral-400 font-bold">
                    {subscription.payment_method_brand || 'Cartão de Crédito'}
                  </span>
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-0 text-3xs">Principal</Badge>
                </div>

                <div className="text-base font-mono tracking-widest py-1">
                  •••• •••• •••• {subscription.payment_method_last4}
                </div>

                <div className="flex items-center justify-between text-2xs text-neutral-400 pt-1 border-t border-white/10">
                  <span>Validade:</span>
                  <span className="font-mono text-white font-semibold">
                    {String(subscription.payment_method_exp_month || 12).padStart(2, '0')}/
                    {subscription.payment_method_exp_year || 2028}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800 text-center space-y-2">
                <CreditCard className="w-8 h-8 mx-auto text-neutral-300 dark:text-neutral-700" />
                <p className="text-xs text-neutral-600 dark:text-neutral-400 font-medium">
                  {isFreePlan
                    ? 'Nenhum cartão cadastrado no plano Free.'
                    : 'Cartão gerenciado pelo Stripe Checkout.'}
                </p>
                <p className="text-2xs text-neutral-400">
                  Ao assinar um plano Pro ou Team, os dados do cartão ficam salvos de forma criptografada no Stripe.
                </p>
              </div>
            )}

            <div className="space-y-2 pt-2">
              <Button
                onClick={handleOpenCustomerPortal}
                disabled={loadingPortal}
                variant="outline"
                className="w-full text-xs justify-center cursor-pointer"
              >
                {loadingPortal ? (
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                )}
                <span>Gerenciar no Stripe Portal</span>
              </Button>

              <div className="flex items-center justify-center gap-1 text-3xs text-neutral-400">
                <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>Criptografia ponta a ponta PCI-DSS Stripe</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plan Selection Section with Monthly/Yearly Toggle */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Escolha o Plano Ideal para seu Workspace</span>
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Desbloqueie mais clientes, membros de equipe, IA multimodal com visão e relatórios avançados.
            </p>
          </div>

          {/* Billing Interval Toggle */}
          <div className="inline-flex p-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 self-start sm:self-auto">
            <button
              onClick={() => setBillingInterval('monthly')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                billingInterval === 'monthly'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              Faturamento Mensal
            </button>
            <button
              onClick={() => setBillingInterval('yearly')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                billingInterval === 'yearly'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              <span>Faturamento Anual</span>
              <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-3xs font-bold px-1.5 py-0.5 rounded-full">
                -17% OFF
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {available_plans.map((p) => {
            const isCurrent = p.id === plan.id;
            const isUpdating = updatingPlan === p.id;
            const price = billingInterval === 'yearly' ? p.price_yearly : p.price_monthly;
            const monthlyEquivalent =
              billingInterval === 'yearly' && p.price_yearly > 0
                ? Math.round(p.price_yearly / 12)
                : p.price_monthly;

            return (
              <div
                key={p.id}
                className={`relative flex flex-col justify-between p-5 rounded-xl border transition-all ${
                  isCurrent
                    ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-300 dark:border-indigo-800 shadow-sm ring-1 ring-indigo-500/20'
                    : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 shadow-xs'
                }`}
              >
                {isCurrent && (
                  <div className="absolute -top-2.5 right-4 bg-indigo-600 text-white text-3xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                    Plano Atual
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                      {p.name}
                    </h4>
                  </div>

                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 min-h-[32px]">
                    {p.description}
                  </p>

                  <div className="mt-4 pb-4 border-b border-neutral-100 dark:border-neutral-800">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-extrabold text-neutral-900 dark:text-neutral-100">
                        {price === 0 ? 'R$ 0' : formatCurrency(monthlyEquivalent)}
                      </span>
                      <span className="text-xs text-neutral-400">
                        {p.id === 'team' ? '/usuário/mês' : '/mês'}
                      </span>
                    </div>

                    {billingInterval === 'yearly' && p.price_yearly > 0 ? (
                      <p className="text-2xs text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                        Cobrado anualmente ({formatCurrency(p.price_yearly)}{p.id === 'team' ? '/ano por usuário' : '/ano'})
                      </p>
                    ) : (
                      p.price_monthly > 0 && (
                        <p className="text-2xs text-neutral-400 mt-0.5">
                          {p.id === 'team'
                            ? 'Cobrança mensal por usuário convidado no workspace'
                            : 'Cobrança recorrente individual mensal'}
                        </p>
                      )
                    )}
                  </div>

                  {/* Limits Highlights */}
                  <div className="py-3 space-y-1.5 text-xs text-neutral-600 dark:text-neutral-300 border-b border-neutral-100 dark:border-neutral-800">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400">Workspaces:</span>
                      <span className="font-semibold">{p.max_workspaces === -1 ? 'Ilimitados' : `${p.max_workspaces ?? 1} workspace`}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400">Clientes:</span>
                      <span className="font-semibold">{p.max_clients === -1 ? 'Ilimitados' : `${p.max_clients} clientes`}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400">Sessões:</span>
                      <span className="font-semibold">
                        {p.max_sessions_per_month === -1 ? 'Ilimitadas' : `${p.max_sessions_per_month ?? 50} sessões/mês`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400">Inteligência Artificial:</span>
                      <span className={`font-semibold ${p.id !== 'free' ? 'text-indigo-600 dark:text-indigo-400' : ''}`}>
                        {p.id === 'free' ? 'Básica' : 'Cronos IA Ilimitada'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400">Membros de Equipe:</span>
                      <span className="font-semibold">
                        {p.id === 'team'
                          ? 'Ilimitados (R$ 9,90/usuário)'
                          : p.id === 'pro'
                          ? 'Individual (1 usuário, sem convites)'
                          : '1 usuário'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400">Backup &amp; Exportação:</span>
                      <span className={`font-semibold ${p.id !== 'free' ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-400'}`}>
                        {p.id === 'free' ? 'Não incluso' : 'Incluso (.json)'}
                      </span>
                    </div>
                  </div>

                  {/* Feature Checklist */}
                  <div className="pt-3 space-y-2">
                    <p className="text-3xs uppercase tracking-wider font-bold text-neutral-400">
                      Recursos inclusos
                    </p>
                    <ul className="space-y-1.5">
                      {p.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-neutral-600 dark:text-neutral-300">
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-6 mt-4">
                  {isCurrent ? (
                    <Button
                      disabled
                      variant="outline"
                      className="w-full text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 cursor-not-allowed border-neutral-200 dark:border-neutral-700"
                    >
                      <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                      <span>Plano Atual</span>
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleSelectPlan(p.id)}
                      disabled={isUpdating}
                      className={`w-full text-xs cursor-pointer justify-center ${
                        p.id === 'pro'
                          ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                          : p.id === 'team'
                          ? 'bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-neutral-200 text-white dark:text-neutral-900'
                          : 'bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200'
                      }`}
                    >
                      {isUpdating ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                          <span>Processando...</span>
                        </>
                      ) : (
                        <>
                          <span>
                            {p.id === 'free'
                              ? 'Mudar para Free'
                              : `Assinar ${p.name} ${is_stripe_configured ? 'via Stripe' : ''}`}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Invoices History Table */}
      <Card className="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
        <CardHeader className="pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Histórico de Faturas e Recibos</span>
              </CardTitle>
              <CardDescription className="text-xs text-neutral-500 dark:text-neutral-400">
                Acesse comprovantes, recibos em PDF e cobranças realizadas pelo Stripe
              </CardDescription>
            </div>
            <Button
              onClick={fetchInvoices}
              disabled={loadingInvoices}
              variant="outline"
              size="sm"
              className="text-xs h-8 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loadingInvoices ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-4 p-0">
          {loadingInvoices ? (
            <div className="p-8 text-center text-xs text-neutral-500">Carregando faturas...</div>
          ) : invoices.length === 0 ? (
            <div className="p-8 text-center space-y-1">
              <FileText className="w-7 h-7 text-neutral-300 dark:text-neutral-700 mx-auto" />
              <p className="text-xs text-neutral-500">Nenhuma fatura registrada até o momento.</p>
              <p className="text-3xs text-neutral-400">
                Faturas geradas no Stripe Checkout ou renovações automáticas aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 dark:bg-neutral-950 text-neutral-500 font-semibold border-b border-neutral-100 dark:border-neutral-800">
                  <tr>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Descrição / ID</th>
                    <th className="px-4 py-3">Valor</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Comprovante</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-neutral-700 dark:text-neutral-300">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-950/40 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap font-medium">
                        {inv.paid_at || inv.created_at
                          ? new Date(inv.paid_at || inv.created_at!).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                          {inv.billing_reason === 'subscription_cycle'
                            ? 'Renovação Mensal de Assinatura'
                            : 'Ativação de Assinatura'}
                        </div>
                        <div className="text-3xs text-neutral-400 font-mono">
                          {inv.gateway_invoice_id || inv.id}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-bold text-neutral-900 dark:text-neutral-100">
                        {formatCurrency(inv.amount)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge
                          className={`text-3xs font-semibold ${
                            inv.status === 'paid'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-0'
                              : inv.status === 'failed'
                              ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border-0'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-0'
                          }`}
                        >
                          {inv.status === 'paid' ? 'Pago' : inv.status === 'failed' ? 'Falha' : 'Pendente'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {inv.hosted_invoice_url || inv.invoice_pdf ? (
                          <a
                            href={inv.hosted_invoice_url || inv.invoice_pdf || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-semibold"
                          >
                            <span>Ver PDF / Recibo</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-3xs text-neutral-400">Recibo no Stripe</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Developer & Test Helper Box (Simulate Webhook) */}
      {import.meta.env.DEV && (
        <div className="p-4 rounded-xl bg-neutral-100 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                🛠️ Testes de Webhooks e Simulações (Fase 2)
              </span>
              <Badge variant="outline" className="text-3xs">
                {is_stripe_configured ? 'Stripe Configurado' : 'Modo Simulado'}
              </Badge>
            </div>
            <span className="text-3xs text-neutral-400">
              Validação de fluxos de confirmação de pagamento e downgrade automático
            </span>
          </div>

          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            Utilize estes gatilhos para testar em tempo real os eventos que o Stripe envia para o webhook{' '}
            <code className="bg-neutral-200 dark:bg-neutral-700 px-1 py-0.5 rounded text-2xs font-mono">
              /api/billing/webhook
            </code>
            :
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              onClick={() => handleSimulateWebhook('checkout.session.completed', 'pro')}
              disabled={simulatingWebhook}
              variant="outline"
              size="sm"
              className="text-2xs h-7 bg-white dark:bg-neutral-900 cursor-pointer"
            >
              Simular Pagamento Pro (checkout.session.completed)
            </Button>

            <Button
              onClick={() => handleSimulateWebhook('invoice.paid', 'team')}
              disabled={simulatingWebhook}
              variant="outline"
              size="sm"
              className="text-2xs h-7 bg-white dark:bg-neutral-900 cursor-pointer"
            >
              Simular Renovação Team (invoice.paid)
            </Button>

            <Button
              onClick={() => handleSimulateWebhook('customer.subscription.deleted')}
              disabled={simulatingWebhook}
              variant="outline"
              size="sm"
              className="text-2xs h-7 bg-white dark:bg-neutral-900 text-red-600 hover:text-red-700 cursor-pointer"
            >
              Simular Cancelamento Total & Downgrade Automático
            </Button>
          </div>
        </div>
      )}

      {/* Cancel Subscription Confirmation Dialog */}
      <Dialog
        open={cancelModalOpen}
        onOpenChange={setCancelModalOpen}
        title="Cancelar Assinatura"
        description="Confirme o cancelamento do plano atual do seu workspace."
      >
        <div className="space-y-4 pt-2 text-xs">
          {usage?.workspaces?.current && usage.workspaces.current > 1 ? (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-800 dark:text-red-300 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-600 dark:text-red-400" />
                Bloqueio de Workspaces Adicionais ({usage.workspaces.current} existentes)
              </p>
              <p className="text-2xs leading-relaxed">
                Sua organização possui {usage.workspaces.current} workspaces. No plano Free, <strong>apenas o primeiro workspace criado continuará liberado</strong>. Os demais workspaces ficarão bloqueados para acesso e qualquer tipo de edição até que você faça um novo upgrade para o plano Pro.
              </p>
            </div>
          ) : null}

          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300 space-y-1">
            <p className="font-semibold">O que acontece ao cancelar?</p>
            <ul className="list-disc pl-4 space-y-1 text-2xs">
              <li>
                <strong>Cancelamento no fim do ciclo (Padrão):</strong> Você continuará com acesso total aos recursos do plano {plan.name} até{' '}
                <strong>{formattedPeriodEnd || 'o término do mês vigente'}</strong>. Ao término, o downgrade para o plano Free ocorrerá de forma 100% automática.
              </li>
              <li>
                <strong>Cancelamento imediato:</strong> O workspace é rebaixado instantaneamente para o plano Free e as novas quotas são aplicadas de imediato.
              </li>
            </ul>
          </div>

          <div className="space-y-2 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={cancelImmediately}
                onChange={(e) => setCancelImmediately(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-neutral-700 dark:text-neutral-300 font-medium">
                Cancelar e aplicar downgrade para o plano Free imediatamente
              </span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-100 dark:border-neutral-800">
            <Button
              onClick={() => setCancelModalOpen(false)}
              variant="outline"
              disabled={canceling}
              className="text-xs cursor-pointer"
            >
              Manter meu Plano
            </Button>

            <Button
              onClick={handleCancelSubscription}
              disabled={canceling}
              className="text-xs bg-red-600 hover:bg-red-700 text-white cursor-pointer"
            >
              {canceling ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  <span>Processando...</span>
                </>
              ) : (
                <span>Confirmar Cancelamento</span>
              )}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Manual Completo das Fases 1 e 2 */}
      {import.meta.env.DEV && (
        <BillingGuideModal open={guideModalOpen} onOpenChange={setGuideModalOpen} />
      )}
    </div>
  );
};
