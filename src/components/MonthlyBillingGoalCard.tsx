import React, { useState, useEffect } from 'react';
import {
  Target,
  Edit2,
  Check,
  X,
  TrendingUp,
  Calendar,
  Sparkles,
  ArrowUpRight,
  Flame,
  CheckCircle2,
  DollarSign,
  Clock,
} from 'lucide-react';
import { MonthlyBillingGoalData } from '../types';
import { formatCurrency } from '../utils/format';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { useToast } from './ui/toast';
import { apiFetch } from '../utils/api';

interface MonthlyBillingGoalCardProps {
  clientId?: string;
  className?: string;
}

const PRESET_GOALS = [5000, 10000, 15000, 20000, 30000, 50000];

export function MonthlyBillingGoalCard({ clientId, className = '' }: MonthlyBillingGoalCardProps) {
  const { addToast } = useToast();
  const [data, setData] = useState<MonthlyBillingGoalData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editGoalValue, setEditGoalValue] = useState<string>('10000');
  const [saving, setSaving] = useState<boolean>(false);

  const fetchGoalData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (clientId) params.append('clientId', clientId);

      const res = await apiFetch(`/api/reports/goal?${params.toString()}`);
      if (!res.ok) throw new Error('Falha ao carregar meta mensal');
      const json: MonthlyBillingGoalData = await res.json();
      setData(json);
      setEditGoalValue(String(json.monthlyGoal || 10000));
      localStorage.setItem('cronos_monthly_billing_goal', String(json.monthlyGoal || 10000));
    } catch (err: any) {
      console.error(err);
      // Fallback from localStorage
      const cachedGoal = Number(localStorage.getItem('cronos_monthly_billing_goal')) || 10000;
      setEditGoalValue(String(cachedGoal));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoalData();
  }, [clientId]);

  const handleSaveGoal = async () => {
    const numericGoal = parseFloat(editGoalValue.replace(/[^\d.,]/g, '').replace(',', '.'));
    if (isNaN(numericGoal) || numericGoal <= 0) {
      addToast({
        title: 'Valor Inválido',
        description: 'Informe um valor positivo maior que zero para a meta mensal.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      const res = await apiFetch('/api/reports/goal', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: numericGoal }),
      });

      if (!res.ok) throw new Error('Erro ao salvar meta');

      localStorage.setItem('cronos_monthly_billing_goal', String(numericGoal));
      addToast({
        title: 'Meta Atualizada!',
        description: `Nova meta mensal de ${formatCurrency(numericGoal)} estabelecida.`,
        variant: 'success',
      });

      setIsEditing(false);
      fetchGoalData();
    } catch (err: any) {
      addToast({
        title: 'Erro ao salvar',
        description: err.message || 'Não foi possível salvar a meta.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const percentage = data ? data.percentage : 0;
  const clampedPercentage = Math.min(100, Math.max(0, percentage));
  const isCompleted = data ? data.isCompleted : false;

  // Determine progress color theme
  const getProgressColor = () => {
    if (isCompleted) return 'bg-emerald-500 dark:bg-emerald-400';
    if (clampedPercentage >= 75) return 'bg-emerald-600 dark:bg-emerald-500';
    if (clampedPercentage >= 40) return 'bg-indigo-600 dark:bg-indigo-500';
    return 'bg-amber-500 dark:bg-amber-400';
  };

  const getProgressGradient = () => {
    if (isCompleted) return 'from-emerald-500 to-teal-400';
    if (clampedPercentage >= 75) return 'from-emerald-600 to-teal-500';
    if (clampedPercentage >= 40) return 'from-indigo-600 to-blue-500';
    return 'from-amber-500 to-orange-400';
  };

  return (
    <Card className={`border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs overflow-hidden ${className}`}>
      {/* Header */}
      <CardHeader className="pb-4 border-b border-neutral-100 dark:border-neutral-800/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/60 shrink-0">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  Meta Mensal de Faturamento
                </CardTitle>
                {data && (
                  <Badge
                    variant={isCompleted ? 'success' : clampedPercentage >= 75 ? 'secondary' : 'outline'}
                    className="text-2xs font-semibold px-2 py-0.5"
                  >
                    {isCompleted ? 'Meta Atingida! 🎉' : `${percentage}% atingido`}
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                <span>
                  {data?.monthLabel || 'Mês Atual'} • Dia {data?.currentDay || 1} de {data?.daysInMonth || 30} ({data?.daysRemaining ?? 0} dias restantes)
                </span>
              </CardDescription>
            </div>
          </div>

          {/* Edit goal toggle */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {!isEditing ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="gap-1.5 text-xs h-8 cursor-pointer border-neutral-200 dark:border-neutral-700"
              >
                <Edit2 className="w-3.5 h-3.5 text-neutral-500" />
                <span>Editar Meta</span>
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(false)}
                className="text-xs h-8 text-neutral-500 cursor-pointer"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                <span>Cancelar</span>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-5">
        {/* Inline Goal Editor */}
        {isEditing && (
          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 space-y-3 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Definir Nova Meta de Faturamento Mensal (R$)
              </label>
              <span className="text-2xs text-neutral-500">Pressione Salvar para atualizar</span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-neutral-400">
                  R$
                </span>
                <Input
                  type="number"
                  step="100"
                  min="1"
                  value={editGoalValue}
                  onChange={(e) => setEditGoalValue(e.target.value)}
                  placeholder="Ex: 15000"
                  className="pl-9 text-sm font-semibold h-9 bg-white dark:bg-neutral-900 font-mono"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveGoal();
                  }}
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={handleSaveGoal}
                  disabled={saving}
                  size="sm"
                  className="h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer px-4"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{saving ? 'Salvando...' : 'Salvar Meta'}</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                  className="h-9 cursor-pointer"
                >
                  Cancelar
                </Button>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-2xs text-neutral-400 font-medium mr-1">Sugestões:</span>
              {PRESET_GOALS.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setEditGoalValue(String(val))}
                  className={`px-2.5 py-1 rounded-md text-2xs font-semibold transition-colors cursor-pointer ${
                    editGoalValue === String(val)
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700'
                      : 'bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  {formatCurrency(val)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Progress Display */}
        <div className="space-y-2.5">
          <div className="flex items-end justify-between text-xs">
            <div>
              <span className="text-neutral-500 dark:text-neutral-400 font-medium">Progresso Realizado:</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl sm:text-3xl font-black text-neutral-900 dark:text-neutral-100 font-mono tracking-tight">
                  {formatCurrency(data?.currentMonthBilling || 0)}
                </span>
                <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                  de {formatCurrency(data?.monthlyGoal || 10000)}
                </span>
              </div>
            </div>

            <div className="text-right">
              <div className="flex items-center justify-end gap-1.5">
                <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-neutral-900 dark:text-neutral-100">
                  {percentage}%
                </span>
              </div>
              <span className="text-2xs font-semibold text-neutral-500 dark:text-neutral-400">
                {isCompleted ? 'Superada em ' + formatCurrency(Math.abs((data?.currentMonthBilling || 0) - (data?.monthlyGoal || 10000))) : `Faltam ${formatCurrency(data?.remaining || 0)}`}
              </span>
            </div>
          </div>

          {/* VISUAL PROGRESS BAR */}
          <div className="relative w-full">
            <div className="w-full h-4 sm:h-5 bg-neutral-100 dark:bg-neutral-800/80 rounded-full overflow-hidden p-0.5 border border-neutral-200/90 dark:border-neutral-700/80 shadow-inner relative">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r ${getProgressGradient()} relative overflow-hidden`}
                style={{ width: `${clampedPercentage}%` }}
              >
                {/* Subtle sheen / highlight animation */}
                <div className="absolute inset-0 bg-white/15 w-full h-full animate-pulse" />
              </div>

              {/* Milestone Ticks: 25%, 50%, 75% */}
              <div className="absolute top-0 bottom-0 left-[25%] w-0.5 bg-white/40 dark:bg-neutral-900/40 pointer-events-none" />
              <div className="absolute top-0 bottom-0 left-[50%] w-0.5 bg-white/40 dark:bg-neutral-900/40 pointer-events-none" />
              <div className="absolute top-0 bottom-0 left-[75%] w-0.5 bg-white/40 dark:bg-neutral-900/40 pointer-events-none" />
            </div>

            {/* Scale Labels */}
            <div className="flex justify-between text-2xs text-neutral-400 dark:text-neutral-500 mt-1 font-mono px-0.5">
              <span>0%</span>
              <span className="hidden sm:inline">25%</span>
              <span>50%</span>
              <span className="hidden sm:inline">75%</span>
              <span className="font-semibold text-neutral-600 dark:text-neutral-300">100% (Meta)</span>
            </div>
          </div>
        </div>

        {/* 4 Micro Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
          {/* 1. Horas Dedicadas */}
          <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700/60">
            <div className="flex items-center justify-between text-2xs text-neutral-500 dark:text-neutral-400 font-medium">
              <span>Horas no Mês</span>
              <Clock className="w-3.5 h-3.5 text-neutral-400" />
            </div>
            <div className="mt-1 text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100 font-mono">
              {data ? `${data.currentMonthHours}h` : '0h'}
            </div>
            <p className="text-2xs text-neutral-400 mt-0.5">
              {data?.sessionsCount || 0} sessões registradas
            </p>
          </div>

          {/* 2. Ritmo Diário Realizado */}
          <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700/60">
            <div className="flex items-center justify-between text-2xs text-neutral-500 dark:text-neutral-400 font-medium">
              <span>Média Realizada</span>
              <TrendingUp className="w-3.5 h-3.5 text-neutral-400" />
            </div>
            <div className="mt-1 text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100 font-mono">
              {formatCurrency(data?.dailyAverage || 0)}
            </div>
            <p className="text-2xs text-neutral-400 mt-0.5">
              por dia até hoje
            </p>
          </div>

          {/* 3. Ritmo Diário Necessário */}
          <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700/60">
            <div className="flex items-center justify-between text-2xs text-neutral-500 dark:text-neutral-400 font-medium">
              <span>Ritmo Necessário</span>
              <Flame className={`w-3.5 h-3.5 ${isCompleted ? 'text-emerald-500' : 'text-amber-500'}`} />
            </div>
            <div className="mt-1 text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100 font-mono">
              {isCompleted ? 'Concluído!' : formatCurrency(data?.dailyNeeded || 0)}
            </div>
            <p className="text-2xs text-neutral-400 mt-0.5">
              {isCompleted ? 'Meta batida no mês' : `/dia nos ${data?.daysRemaining || 0} dias restantes`}
            </p>
          </div>

          {/* 4. Projeção de Conclusão */}
          <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700/60">
            <div className="flex items-center justify-between text-2xs text-neutral-500 dark:text-neutral-400 font-medium">
              <span>Projeção Mensal</span>
              <Sparkles className="w-3.5 h-3.5 text-neutral-400" />
            </div>
            <div className="mt-1 text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100 font-mono">
              {data && data.dailyAverage > 0
                ? formatCurrency(data.dailyAverage * data.daysInMonth)
                : formatCurrency(data?.currentMonthBilling || 0)}
            </div>
            <p className="text-2xs text-neutral-400 mt-0.5">
              no ritmo atual até o fim do mês
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
