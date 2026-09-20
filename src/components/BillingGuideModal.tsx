import React, { useState } from 'react';
import {
  BookOpen,
  CreditCard,
  ShieldCheck,
  Zap,
  RotateCcw,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  Layers,
  Terminal,
  FileText,
  Clock,
  Sparkles,
  Users,
  HardDrive,
  Briefcase,
  AlertTriangle,
} from 'lucide-react';
import { Dialog } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useToast } from './ui/toast';

interface BillingGuideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const BillingGuideModal: React.FC<BillingGuideModalProps> = ({ open, onOpenChange }) => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'phase1' | 'phase2' | 'setup' | 'api'>('overview');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(label);
      setTimeout(() => setCopiedKey(null), 2000);
      addToast({
        title: 'Copiado!',
        description: `${label} copiado para a área de transferência.`,
        variant: 'default',
      });
    } catch {
      addToast({
        title: 'Erro ao copiar',
        description: 'Não foi possível copiar o texto.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Manual Completo de Faturamento & Recorrência (Fase 1 e Fase 2)"
      className="max-w-4xl max-h-[88vh] flex flex-col p-0 overflow-hidden"
    >
      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 px-4 pt-2 overflow-x-auto gap-1">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'overview'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-neutral-900'
              : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Visão Geral</span>
        </button>

        <button
          onClick={() => setActiveTab('phase1')}
          className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'phase1'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-neutral-900'
              : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Fase 1: Quotas & Limites</span>
        </button>

        <button
          onClick={() => setActiveTab('phase2')}
          className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'phase2'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-neutral-900'
              : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Fase 2: Stripe & Webhooks</span>
        </button>

        <button
          onClick={() => setActiveTab('setup')}
          className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'setup'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-neutral-900'
              : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Guia de Implantação Stripe</span>
        </button>

        <button
          onClick={() => setActiveTab('api')}
          className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'api'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-neutral-900'
              : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Rotas da API</span>
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 text-neutral-800 dark:text-neutral-200 text-xs leading-relaxed">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60">
              <h3 className="font-bold text-sm text-indigo-950 dark:text-indigo-200 mb-1 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Arquitetura do Cronos Time Tracker & Billing
              </h3>
              <p className="text-neutral-600 dark:text-neutral-300">
                O módulo de faturamento e monetização do Cronos foi arquitetado para suportar workspaces multi-tenant de forma segura, escalável e com estrita conformidade às regras de negócio e limites de uso contratados.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border-0 font-bold">
                    Fase 1
                  </Badge>
                  <h4 className="font-semibold text-neutral-900 dark:text-neutral-100">Core de Quotas & Planos</h4>
                </div>
                <ul className="space-y-1.5 text-neutral-600 dark:text-neutral-400 list-disc list-inside">
                  <li>Modelagem de dados: <code className="text-2xs font-mono">plans</code>, <code className="text-2xs font-mono">subscriptions</code>, <code className="text-2xs font-mono">invoices</code>.</li>
                  <li>Planos <strong>Free</strong>, <strong>Pro</strong> e <strong>Team</strong> pré-configurados.</li>
                  <li>Cálculo em tempo real de limites de membros, clientes e MBs de armazenamento.</li>
                  <li>Middlewares que barram cadastros ao atingir o teto do plano.</li>
                  <li>Travas de segurança no assistente de IA (Kilo/Gemini) para impedir bypass de clientes.</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border-0 font-bold">
                    Fase 2
                  </Badge>
                  <h4 className="font-semibold text-neutral-900 dark:text-neutral-100">Stripe & Recorrência</h4>
                </div>
                <ul className="space-y-1.5 text-neutral-600 dark:text-neutral-400 list-disc list-inside">
                  <li>Stripe Checkout com suporte a ciclos <strong>Mensal</strong> e <strong>Anual (-17% OFF)</strong>.</li>
                  <li>Stripe Customer Portal para gestão autônoma de cartões e faturas.</li>
                  <li>Webhook público com assinatura criptográfica (<code className="text-2xs font-mono">rawBody</code>).</li>
                  <li>Downgrade automático para Free por cancelamento ou término do ciclo pago.</li>
                  <li>Histórico completo de faturas com links para PDFs e recibos oficiais.</li>
                </ul>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-2">
              <h4 className="font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Segurança e Conformidade PCI-DSS
              </h4>
              <p className="text-neutral-600 dark:text-neutral-400">
                O Cronos <strong>nunca</strong> recebe, trafega ou armazena números completos de cartões de crédito ou códigos de segurança (CVV). Toda a coleta é realizada diretamente pelos servidores seguros do Stripe via formulários hospedados com criptografia bancária. No banco local são guardados apenas a bandeira e os últimos 4 dígitos para identificação amigável.
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: PHASE 1 */}
        {activeTab === 'phase1' && (
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-2">
                Matriz Oficial dos Planos e Limites
              </h3>
              <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
                <table className="w-full text-left border-collapse text-2xs sm:text-xs">
                  <thead>
                    <tr className="bg-neutral-100 dark:bg-neutral-800/80 text-neutral-700 dark:text-neutral-300 font-semibold border-b border-neutral-200 dark:border-neutral-800">
                      <th className="p-2.5">Recurso</th>
                      <th className="p-2.5">Free</th>
                      <th className="p-2.5">Pro</th>
                      <th className="p-2.5">Team</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    <tr>
                      <td className="p-2.5 font-medium">Preço Mensal</td>
                      <td className="p-2.5">R$ 0,00</td>
                      <td className="p-2.5 text-indigo-600 font-bold">R$ 4,99 / mês</td>
                      <td className="p-2.5 text-indigo-600 font-bold">R$ 9,90 / usuário / mês</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium">Preço Anual (17% OFF)</td>
                      <td className="p-2.5">-</td>
                      <td className="p-2.5 text-emerald-600 font-bold">R$ 49,90 / ano</td>
                      <td className="p-2.5 text-emerald-600 font-bold">R$ 99,00 / usuário / ano</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-neutral-400" /> Workspaces
                      </td>
                      <td className="p-2.5">1 workspace</td>
                      <td className="p-2.5 font-bold text-indigo-600">Ilimitados</td>
                      <td className="p-2.5 font-bold text-indigo-600">Ilimitados</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium flex items-center gap-1">
                        <Briefcase className="w-3.5 h-3.5 text-neutral-400" /> Clientes
                      </td>
                      <td className="p-2.5">Até 3 clientes</td>
                      <td className="p-2.5 font-bold text-indigo-600">Ilimitados</td>
                      <td className="p-2.5 font-bold text-indigo-600">Ilimitados</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-neutral-400" /> Sessões
                      </td>
                      <td className="p-2.5">50 sessões / mês</td>
                      <td className="p-2.5 font-bold text-indigo-600">Ilimitadas</td>
                      <td className="p-2.5 font-bold text-indigo-600">Ilimitadas</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-neutral-400" /> Membros de Equipe
                      </td>
                      <td className="p-2.5">1 usuário</td>
                      <td className="p-2.5 font-bold text-neutral-600">Individual (1 usuário, sem convites)</td>
                      <td className="p-2.5 font-bold text-indigo-600">Ilimitados (R$ 9,90 por assento)</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-neutral-400" /> Cronos AI Assistant
                      </td>
                      <td className="p-2.5">Básico</td>
                      <td className="p-2.5 font-bold text-indigo-600">Ilimitado com Visão & Áudio</td>
                      <td className="p-2.5 font-bold text-indigo-600">Ilimitado + Equipe & Integrações</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium flex items-center gap-1">
                        <HardDrive className="w-3.5 h-3.5 text-neutral-400" /> Exportação Completa de Dados
                      </td>
                      <td className="p-2.5 text-neutral-400">Não disponível</td>
                      <td className="p-2.5 font-bold text-emerald-600">Incluso (Backup JSON)</td>
                      <td className="p-2.5 font-bold text-emerald-600">Incluso (Backup JSON)</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium flex items-center gap-1">
                        <HardDrive className="w-3.5 h-3.5 text-neutral-400" /> Armazenamento
                      </td>
                      <td className="p-2.5">500 MB</td>
                      <td className="p-2.5">10 GB (10.240 MB)</td>
                      <td className="p-2.5 font-bold text-indigo-600">50 GB (51.200 MB)</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium">Repositórios Git</td>
                      <td className="p-2.5">1 repositório</td>
                      <td className="p-2.5">Ilimitados</td>
                      <td className="p-2.5">Ilimitados + Permissões por Membro</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-neutral-900 dark:text-neutral-100">
                Travas Ativas & Middlewares de Proteção
              </h4>
              <p className="text-neutral-600 dark:text-neutral-400">
                O motor <code className="text-2xs font-mono">enforcePlanLimit(resource)</code> protege os endpoints no backend:
              </p>
              <div className="p-3 rounded-xl bg-neutral-900 text-neutral-200 font-mono text-2xs space-y-1">
                <p className="text-neutral-400">// Exemplo de retorno caso o limite de clientes seja excedido:</p>
                <p className="text-amber-300">HTTP 403 Forbidden</p>
                <p>{`{`}</p>
                <p className="pl-4">{`"error": "Limite de clientes atingido para o plano Free (3/3). Faça upgrade para continuar cadastrando.",`}</p>
                <p className="pl-4">{`"plan_limit_exceeded": true,`}</p>
                <p className="pl-4">{`"resource": "clients",`}</p>
                <p className="pl-4">{`"current": 3,`}</p>
                <p className="pl-4">{`"max": 3`}</p>
                <p>{`}`}</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PHASE 2 */}
        {activeTab === 'phase2' && (
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-2">
                Fluxo de Recorrência e Webhooks em Tempo Real
              </h3>
              <p className="text-neutral-600 dark:text-neutral-400 mb-3">
                O Webhook <code className="text-2xs font-mono">POST /api/billing/webhook</code> processa automaticamente os eventos do Stripe com validação de assinatura criptográfica.
              </p>

              <div className="space-y-2.5">
                <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40 flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-neutral-900 dark:text-neutral-100 font-mono text-2xs">checkout.session.completed</strong>
                    <p className="text-neutral-600 dark:text-neutral-400 text-2xs mt-0.5">
                      Sessão de checkout concluída pelo cliente. Ativa o plano Pro ou Team, salva o ID de customer/subscription, captura a bandeira e final do cartão e emite a fatura inicial.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40 flex items-start gap-3">
                  <Zap className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-neutral-900 dark:text-neutral-100 font-mono text-2xs">invoice.paid / invoice.payment_succeeded</strong>
                    <p className="text-neutral-600 dark:text-neutral-400 text-2xs mt-0.5">
                      Renovação automática do ciclo (mensal ou anual). Atualiza as datas de vigência (<code className="text-2xs font-mono">current_period_end</code>) e anexa o PDF do recibo oficial.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40 flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-neutral-900 dark:text-neutral-100 font-mono text-2xs">invoice.payment_failed</strong>
                    <p className="text-neutral-600 dark:text-neutral-400 text-2xs mt-0.5">
                      Falha na cobrança (cartão expirado ou sem limite). Define o status da assinatura como <code className="text-2xs font-mono">past_due</code> e aciona o alerta vermelho na interface do usuário.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40 flex items-start gap-3">
                  <RotateCcw className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-neutral-900 dark:text-neutral-100 font-mono text-2xs">customer.subscription.deleted</strong>
                    <p className="text-neutral-600 dark:text-neutral-400 text-2xs mt-0.5">
                      Downgrade automático: cancelamento consumado no Stripe rebaixa imediatamente o plano do workspace para <strong>Free</strong>.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-2">
              <h4 className="font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" />
                Cancelamento Agendado vs. Downgrade Automático
              </h4>
              <p className="text-neutral-600 dark:text-neutral-400">
                Ao cancelar uma assinatura, o usuário pode optar por manter o acesso até o fim do ciclo vigente (<code className="text-2xs font-mono">cancel_at_period_end = true</code>). O sistema audita ativamente a expiração em tempo de execução: assim que a data atual ultrapassa o período faturado, o downgrade para o plano Free é formalizado.
              </p>
            </div>
          </div>
        )}

        {/* TAB 4: SETUP GUIDE */}
        {activeTab === 'setup' && (
          <div className="space-y-5">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              Guia Passo a Passo de Configuração no Stripe Dashboard
            </h3>

            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/30 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-neutral-900 dark:text-neutral-100">1. Obter a Chave Secreta</h4>
                  <a
                    href="https://dashboard.stripe.com/apikeys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-2xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    Abrir Stripe API Keys <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-neutral-600 dark:text-neutral-400">
                  Acesse o menu <strong>Developers &rarr; API keys</strong> e copie a <strong>Secret key</strong> (<code className="text-2xs font-mono">sk_test_...</code> ou <code className="text-2xs font-mono">sk_live_...</code>).
                </p>
                <div className="flex items-center gap-2">
                  <code className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded font-mono text-2xs flex-1">
                    STRIPE_SECRET_KEY=sk_test_...
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-2xs cursor-pointer"
                    onClick={() => handleCopy('STRIPE_SECRET_KEY=sk_test_...', 'Variável Stripe Key')}
                  >
                    {copiedKey === 'Variável Stripe Key' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  </Button>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/30 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-neutral-900 dark:text-neutral-100">2. Configurar o Webhook Endpoint</h4>
                  <a
                    href="https://dashboard.stripe.com/webhooks"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-2xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    Abrir Stripe Webhooks <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-neutral-600 dark:text-neutral-400">
                  Cadastre a URL do webhook no Stripe Dashboard:
                </p>
                <div className="flex items-center gap-2">
                  <code className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded font-mono text-2xs flex-1">
                    {window.location.origin}/api/billing/webhook
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-2xs cursor-pointer"
                    onClick={() => handleCopy(`${window.location.origin}/api/billing/webhook`, 'URL do Webhook')}
                  >
                    {copiedKey === 'URL do Webhook' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  </Button>
                </div>
                <p className="text-neutral-500 text-2xs">
                  Eventos recomendados: <code className="font-mono">checkout.session.completed</code>, <code className="font-mono">invoice.paid</code>, <code className="font-mono">invoice.payment_failed</code>, <code className="font-mono">customer.subscription.updated</code>, <code className="font-mono">customer.subscription.deleted</code>.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/30 space-y-2">
                <h4 className="font-bold text-neutral-900 dark:text-neutral-100">3. Teste Local com Stripe CLI</h4>
                <p className="text-neutral-600 dark:text-neutral-400">
                  Para redirecionar webhooks do Stripe diretamente para a sua porta 3000 em ambiente local:
                </p>
                <div className="flex items-center gap-2">
                  <code className="p-2 bg-neutral-900 text-neutral-200 rounded font-mono text-2xs flex-1">
                    stripe listen --forward-to localhost:3000/api/billing/webhook
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-2xs cursor-pointer"
                    onClick={() => handleCopy('stripe listen --forward-to localhost:3000/api/billing/webhook', 'Comando Stripe CLI')}
                  >
                    {copiedKey === 'Comando Stripe CLI' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: API REFERENCE */}
        {activeTab === 'api' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              Referência de Endpoints de Faturamento (/api/billing/*)
            </h3>

            <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
              <table className="w-full text-left border-collapse text-2xs">
                <thead>
                  <tr className="bg-neutral-100 dark:bg-neutral-800/80 text-neutral-700 dark:text-neutral-300 font-semibold border-b border-neutral-200 dark:border-neutral-800">
                    <th className="p-2.5">Método</th>
                    <th className="p-2.5">Rota</th>
                    <th className="p-2.5">Descrição</th>
                    <th className="p-2.5">Autenticação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 font-mono">
                  <tr>
                    <td className="p-2.5 text-blue-600 font-bold">GET</td>
                    <td className="p-2.5">/api/billing/status</td>
                    <td className="p-2.5 font-sans">Retorna plano atual, consumo de cotas e dados do cartão</td>
                    <td className="p-2.5 font-sans">JWT</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-blue-600 font-bold">GET</td>
                    <td className="p-2.5">/api/billing/plans</td>
                    <td className="p-2.5 font-sans">Lista todos os planos comercializados</td>
                    <td className="p-2.5 font-sans">JWT</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-blue-600 font-bold">GET</td>
                    <td className="p-2.5">/api/billing/invoices</td>
                    <td className="p-2.5 font-sans">Retorna histórico de faturas e recibos</td>
                    <td className="p-2.5 font-sans">JWT</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-emerald-600 font-bold">POST</td>
                    <td className="p-2.5">/api/billing/create-checkout-session</td>
                    <td className="p-2.5 font-sans">Gera URL de checkout recorrente ou simula upgrade</td>
                    <td className="p-2.5 font-sans">JWT</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-emerald-600 font-bold">POST</td>
                    <td className="p-2.5">/api/billing/customer-portal</td>
                    <td className="p-2.5 font-sans">Gera link para o Stripe Customer Portal</td>
                    <td className="p-2.5 font-sans">JWT</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-emerald-600 font-bold">POST</td>
                    <td className="p-2.5">/api/billing/cancel-subscription</td>
                    <td className="p-2.5 font-sans">Agenda cancelamento ao fim do ciclo ou cancela imediatamente</td>
                    <td className="p-2.5 font-sans">JWT</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-emerald-600 font-bold">POST</td>
                    <td className="p-2.5">/api/billing/reactivate-subscription</td>
                    <td className="p-2.5 font-sans">Reativa plano com cancelamento agendado</td>
                    <td className="p-2.5 font-sans">JWT</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-emerald-600 font-bold">POST</td>
                    <td className="p-2.5">/api/billing/webhook</td>
                    <td className="p-2.5 font-sans">Recebe eventos do Stripe via assinatura criptográfica</td>
                    <td className="p-2.5 font-sans text-amber-600 font-bold">Público (Stripe-Sig)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-2xs text-neutral-500">
        <span>Documentação oficial das Fases 1 & 2 • Arquivo em <code className="font-mono">/DOCUMENTACAO_FASE_1_E_2.md</code></span>
        <Button size="sm" variant="outline" onClick={() => onOpenChange(false)} className="text-xs h-8 cursor-pointer">
          Fechar Manual
        </Button>
      </div>
    </Dialog>
  );
};
