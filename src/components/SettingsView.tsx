import React, { useState, useEffect } from 'react';
import {
  Save,
  User as UserIcon,
  Building2,
  DollarSign,
  Shield,
  Sparkles,
} from 'lucide-react';
import { User, Tenant } from '../types';
import { formatCurrency } from '../utils/format';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
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

  useEffect(() => {
    if (user) {
      setName(user.name);
      setHourlyRate(user.default_hourly_rate.toString());
    }
    if (tenant) {
      setTenantName(tenant.name);
    }
  }, [user, tenant]);

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
