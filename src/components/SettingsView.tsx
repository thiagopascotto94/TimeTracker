import React, { useState, useEffect } from 'react';
import {
  Save,
  User as UserIcon,
  Building2,
  DollarSign,
  Shield,
  CheckCircle2,
  Cpu,
  ExternalLink,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { User, Tenant } from '../types';
import { formatCurrency } from '../utils/format';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { useToast } from './ui/toast';

interface SettingsViewProps {
  user: User | null;
  tenant: Tenant | null;
  onUpdateProfile: (data: {
    name: string;
    default_hourly_rate: number;
    tenant_name: string;
  }) => Promise<void>;
  loading: boolean;
}

interface ProviderInfo {
  activeProvider: 'kilo' | 'gemini' | 'none';
  kilo: {
    isConfigured: boolean;
    hasModelSecret: boolean;
    model: string | null;
    baseURL: string;
    docsUrl: string;
  };
  gemini: {
    isConfigured: boolean;
    defaultModel: string;
  };
}

export function SettingsView({
  user,
  tenant,
  onUpdateProfile,
  loading,
}: SettingsViewProps) {
  const { addToast } = useToast();

  const [name, setName] = useState(user?.name || '');
  const [hourlyRate, setHourlyRate] = useState(
    user?.default_hourly_rate ? user.default_hourly_rate.toString() : '150'
  );
  const [tenantName, setTenantName] = useState(tenant?.name || '');
  const [providerInfo, setProviderInfo] = useState<ProviderInfo | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setHourlyRate(user.default_hourly_rate.toString());
    }
    if (tenant) {
      setTenantName(tenant.name);
    }
  }, [user, tenant]);

  useEffect(() => {
    fetch('/api/ai/provider')
      .then((res) => res.json())
      .then((data) => setProviderInfo(data))
      .catch((err) => console.error('Erro ao carregar status do provedor IA:', err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rateNum = parseFloat(hourlyRate);
    if (isNaN(rateNum) || rateNum < 0) {
      addToast({
        title: 'Valor inválido',
        description: 'Por favor informe uma taxa por hora válida maior ou igual a zero.',
        variant: 'destructive',
      });
      return;
    }

    await onUpdateProfile({
      name: name.trim(),
      default_hourly_rate: rateNum,
      tenant_name: tenantName.trim(),
    });
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
          Configurações &amp; Perfil
        </h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Configure sua precificação padrão por hora e os dados do seu espaço multitenant.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card 1: Faturamento & Taxa Horária */}
        <Card className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs">
          <CardHeader>
            <CardTitle className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>Precificação &amp; Faturamento</span>
            </CardTitle>
            <CardDescription className="text-xs text-neutral-500 dark:text-neutral-400">
              Este valor é utilizado nos relatórios para multiplicar automaticamente as horas decimais trabalhadas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Valor Base por Hora (R$)
              </label>
              <div className="relative max-w-xs">
                <span className="absolute left-3 top-2.5 text-xs text-neutral-400 font-semibold">
                  R$
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  className="pl-10 font-mono text-sm"
                  required
                />
              </div>
              <p className="text-2xs text-neutral-400">
                Pré-visualização: {formatCurrency(parseFloat(hourlyRate) || 0)} por hora faturável.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Perfil do Usuário */}
        <Card className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs">
          <CardHeader>
            <CardTitle className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
              <span>Dados do Profissional</span>
            </CardTitle>
            <CardDescription className="text-xs text-neutral-500 dark:text-neutral-400">
              Identificação do prestador de serviços nos relatórios.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Nome Completo
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-sm"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Email de Acesso
                </label>
                <Input
                  value={user?.email || ''}
                  disabled
                  className="text-sm bg-neutral-50 dark:bg-neutral-850 text-neutral-500 dark:text-neutral-400 cursor-not-allowed"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Multitenancy & Workspace */}
        <Card className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs">
          <CardHeader>
            <CardTitle className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>Espaço Multitenant (Workspace)</span>
            </CardTitle>
            <CardDescription className="text-xs text-neutral-500 dark:text-neutral-400">
              Isolamento de dados por Tenant ID (RF02). Todas as sessões e anotações pertencem a este ambiente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Nome do Workspace
              </label>
              <Input
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                className="text-sm"
                required
              />
            </div>

            <div className="rounded-lg border border-neutral-200 dark:border-neutral-750 bg-neutral-50 dark:bg-neutral-850 p-3 text-xs text-neutral-600 dark:text-neutral-300 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-neutral-800 dark:text-neutral-200">
                <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span style={{ color: '#000000' }}>Tenant ID Ativo:</span>
                <code className="font-mono text-2xs bg-white dark:bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-700">
                  {tenant?.id || user?.tenant_id}
                </code>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Gateway de IA (Kilo AI / OpenAI Compatível) */}
        <Card className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <Cpu className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                <span>Integração Kilo AI Gateway</span>
              </CardTitle>
              <a
                href="https://kilo.ai/docs/gateway"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 hover:underline font-semibold"
              >
                <span>Documentação oficial</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <CardDescription className="text-xs text-neutral-500 dark:text-neutral-400">
              Gateway OpenAI compatível com roteamento inteligente, suporte a múltiplos modelos e function calling de até 60 etapas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Endpoint Base */}
              <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850 space-y-1">
                <span className="text-neutral-500 dark:text-neutral-400 font-medium block">
                  Gateway Base URL:
                </span>
                <code className="font-mono text-2xs font-semibold text-neutral-800 dark:text-neutral-200 break-all">
                  {providerInfo?.kilo?.baseURL || 'https://api.kilo.ai/api/gateway'}
                </code>
              </div>

              {/* Status do Provedor Ativo */}
              <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850 space-y-1">
                <span className="text-neutral-500 dark:text-neutral-400 font-medium block">
                  Provedor Ativo:
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      providerInfo?.activeProvider === 'kilo'
                        ? 'bg-violet-500 animate-pulse'
                        : providerInfo?.activeProvider === 'gemini'
                        ? 'bg-emerald-500'
                        : 'bg-neutral-400'
                    }`}
                  />
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200 uppercase">
                    {providerInfo?.activeProvider || 'Carregando...'}
                  </span>
                </div>
              </div>
            </div>

            {/* Status das Secrets */}
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                    KILO_API_KEY
                  </span>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    (Secret com chave de acesso)
                  </span>
                </div>
                {providerInfo?.kilo?.isConfigured ? (
                  <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 text-[10px]">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Configurada
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-300 dark:border-neutral-700 text-[10px]">
                    Não configurada
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                    KILO_MODEL
                  </span>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    (Secret com o nome do modelo)
                  </span>
                </div>
                {providerInfo?.kilo?.hasModelSecret ? (
                  <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 text-[10px]">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    {providerInfo.kilo.model}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 text-[10px]">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Pendente
                  </Badge>
                )}
              </div>
            </div>

            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              💡 <em>Dica:</em> Tanto a chave de API quanto o modelo permanecem salvos em secrets protegidas no servidor, nunca expostos no navegador. Exemplos de modelos suportados pelo Kilo Gateway: <code>anthropic/claude-3-5-sonnet</code>, <code>openai/gpt-4o</code>, <code>google/gemini-2.5-flash</code>, <code>deepseek/deepseek-chat</code>.
            </p>
          </CardContent>
        </Card>

        {/* Save button */}
        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={loading}
            className="gap-2 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 shadow-sm px-6 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? 'Salvando...' : 'Salvar Alterações'}</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
