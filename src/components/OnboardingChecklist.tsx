import React, { useState, useEffect } from 'react';
import { Sparkles, CheckCircle2, Circle, ArrowRight, X, UserPlus, Briefcase, Play, FileText } from 'lucide-react';
import { Button } from './ui/button';

interface OnboardingChecklistProps {
  clientsCount: number;
  sessionsCount: number;
  onNavigate: (tab: 'clients' | 'reports' | 'timer' | 'settings') => void;
}

export function OnboardingChecklist({
  clientsCount,
  sessionsCount,
  onNavigate,
}: OnboardingChecklistProps) {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('cronos_onboarding_dismissed') === 'true';
  });

  const hasClient = clientsCount > 0;
  const hasSession = sessionsCount > 0;
  const completedSteps = (hasClient ? 1 : 0) + (hasSession ? 1 : 0);
  const totalSteps = 2;
  const progressPercent = Math.round((completedSteps / totalSteps) * 100);

  if (dismissed || progressPercent === 100) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem('cronos_onboarding_dismissed', 'true');
    } catch (e) {
      // Ignore
    }
  };

  return (
    <div className="rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-50/70 via-white to-purple-50/50 dark:from-indigo-950/30 dark:via-neutral-900 dark:to-neutral-900 p-5 shadow-xs relative overflow-hidden mb-6">
      <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-start justify-between gap-4 relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-xs">
              <Sparkles className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
              Primeiros Passos no Cronos
            </h3>
            <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {progressPercent}% Concluído
            </span>
          </div>
          <p className="text-xs text-neutral-600 dark:text-neutral-300 max-w-xl">
            Siga o checklist abaixo para configurar sua produtividade e começar a faturar suas horas com precisão cirúrgica.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 p-1 rounded-lg transition-colors cursor-pointer"
          title="Dispensar orientações"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="mt-4 w-full bg-neutral-200 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
        <div
          className="bg-indigo-600 dark:bg-indigo-500 h-full transition-all duration-500 rounded-full"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Steps Grid */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 relative z-10">
        {/* Step 1: Client */}
        <div
          className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
            hasClient
              ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-200'
              : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-indigo-300'
          }`}
        >
          <div className="flex items-center gap-3">
            {hasClient ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <Circle className="w-5 h-5 text-neutral-300 dark:text-neutral-700 shrink-0" />
            )}
            <div>
              <p className="text-xs font-bold">1. Cadastrar seu 1º Cliente</p>
              <p className="text-2xs text-neutral-500 dark:text-neutral-400">
                {hasClient ? 'Cliente cadastrado com sucesso!' : 'Organize projetos e taxas por cliente'}
              </p>
            </div>
          </div>
          {!hasClient && (
            <Button
              onClick={() => onNavigate('clients')}
              size="sm"
              variant="outline"
              className="h-7 text-2xs px-2.5 font-semibold gap-1 cursor-pointer border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50"
            >
              <span>Cadastrar</span>
              <ArrowRight className="w-3 h-3" />
            </Button>
          )}
        </div>

        {/* Step 2: Session */}
        <div
          className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
            hasSession
              ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-200'
              : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-indigo-300'
          }`}
        >
          <div className="flex items-center gap-3">
            {hasSession ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <Circle className="w-5 h-5 text-neutral-300 dark:text-neutral-700 shrink-0" />
            )}
            <div>
              <p className="text-xs font-bold">2. Iniciar sua 1ª Sessão</p>
              <p className="text-2xs text-neutral-500 dark:text-neutral-400">
                {hasSession ? 'Timer testado com sucesso!' : 'Rastreie o tempo de trabalho em tempo real'}
              </p>
            </div>
          </div>
          {!hasSession && (
            <Button
              onClick={() => onNavigate('timer')}
              size="sm"
              variant="outline"
              className="h-7 text-2xs px-2.5 font-semibold gap-1 cursor-pointer border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50"
            >
              <span>Ir ao Timer</span>
              <Play className="w-3 h-3 fill-current" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
