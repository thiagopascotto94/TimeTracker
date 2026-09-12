import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Square,
  Plus,
  Trash2,
  Bell,
  BellOff,
  Link2,
  Target,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Briefcase,
  Building2,
} from 'lucide-react';
import { TimeSession, TaskItem, Client } from '../types';
import {
  formatTimeHHMMSS,
  formatCurrency,
  formatDateTime,
  calculateElapsedMs,
} from '../utils/format';
import { playGoalChime } from '../utils/audio';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { ClientAutocomplete } from './ClientAutocomplete';
import { Badge } from './ui/badge';
import { useToast } from './ui/toast';

interface TimerViewProps {
  activeSession: TimeSession | null;
  clients: Client[];
  hourlyRate: number;
  resumeSession?: TimeSession | null;
  onClearResumeSession?: () => void;
  onStartSession: (data: {
    title: string;
    target_minutes: number | null;
    previous_session_id: string | null;
    client_id: string | null;
  }) => Promise<void>;
  onStopSession: (sessionId: string) => Promise<void>;
  onAddTask: (sessionId: string, description: string) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  loading: boolean;
}

export function TimerView({
  activeSession,
  clients,
  hourlyRate,
  resumeSession,
  onClearResumeSession,
  onStartSession,
  onStopSession,
  onAddTask,
  onDeleteTask,
  loading,
}: TimerViewProps) {
  const { addToast } = useToast();

  // Resilient elapsed time tracking (calculated from server start_time)
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [taskInput, setTaskInput] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // New session form state
  const [title, setTitle] = useState('');
  const [targetMinutes, setTargetMinutes] = useState<number | null>(60);
  const [customTarget, setCustomTarget] = useState('');
  const [clientId, setClientId] = useState<string>('');

  // Handle resumeSession prop synchronization
  useEffect(() => {
    if (resumeSession) {
      if (resumeSession.client_id) {
        setClientId(resumeSession.client_id);
      }
      if (!title) {
        setTitle(`Continuação: ${resumeSession.title || 'Sessão Anterior'}`);
      }
    }
  }, [resumeSession]);

  // Target reached alert guard (only trigger once per session)
  const alertTriggeredRef = useRef<boolean>(false);
  const activeSessionIdRef = useRef<string | null>(null);

  // Reset alert trigger when active session changes
  useEffect(() => {
    if (activeSession?.id !== activeSessionIdRef.current) {
      activeSessionIdRef.current = activeSession?.id || null;
      alertTriggeredRef.current = false;
    }
  }, [activeSession?.id]);

  // Resilient Timer Loop: Computes delta using Date.now() - start_time
  // Tab Throttling resilience: doesn't rely on 1s cumulative increments
  useEffect(() => {
    if (!activeSession || !activeSession.start_time) {
      setElapsedMs(0);
      return;
    }

    const updateTimer = () => {
      const currentElapsed = calculateElapsedMs(activeSession.start_time);
      setElapsedMs(currentElapsed);

      // Check target alert (RF04)
      if (activeSession.target_minutes && activeSession.target_minutes > 0) {
        const targetMs = activeSession.target_minutes * 60 * 1000;
        if (currentElapsed >= targetMs && !alertTriggeredRef.current) {
          alertTriggeredRef.current = true;
          if (soundEnabled) {
            playGoalChime();
          }
          addToast({
            title: '🎯 Meta de tempo atingida!',
            description: `Você completou o objetivo de ${activeSession.target_minutes} minutos nesta sessão.`,
            variant: 'amber',
          });
        }
      }
    };

    // Initial update
    updateTimer();

    // 1-second interval for clock display
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeSession, soundEnabled, addToast]);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalTarget = customTarget ? Number(customTarget) : targetMinutes;
    await onStartSession({
      title: title.trim(),
      target_minutes: finalTarget && finalTarget > 0 ? finalTarget : null,
      previous_session_id: resumeSession ? resumeSession.id : null,
      client_id: clientId ? clientId : null,
    });
    setTitle('');
    setCustomTarget('');
    setClientId('');
    if (onClearResumeSession) onClearResumeSession();
  };

  const handleAddTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession || !taskInput.trim() || loading) return;
    const desc = taskInput.trim();
    setTaskInput('');
    await onAddTask(activeSession.id, desc);
  };

  // Target calculations
  const targetMs = activeSession?.target_minutes
    ? activeSession.target_minutes * 60 * 1000
    : null;
  const isTargetMet = targetMs ? elapsedMs >= targetMs : false;
  const progressPercent = targetMs
    ? Math.min(100, Math.round((elapsedMs / targetMs) * 100))
    : 0;

  // Real-time billable value (using client custom rate if available)
  const activeClient = activeSession?.Client || activeSession?.client;
  const sessionHourlyRate = activeClient?.hourly_rate ?? hourlyRate;
  const decimalHours = elapsedMs / 3600000;
  const currentBillable = decimalHours * sessionHourlyRate;

  // Tasks of active session
  const activeTasks: TaskItem[] = activeSession?.Tasks || activeSession?.tasks || [];

  return (
    <div className="space-y-6">
      {/* ACTIVE TIMER RUNNING */}
      {activeSession ? (
        <div className="space-y-6">
          {/* Main Timer Display Card */}
          <Card
            className={`border-2 transition-all duration-500 overflow-hidden shadow-md ${
              isTargetMet
                ? 'border-amber-400 bg-amber-50/40 dark:bg-amber-950/30 ring-2 ring-amber-300/40'
                : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900'
            }`}
          >
            <CardHeader className="pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      Sessão em Andamento
                    </span>
                    {activeSession.target_minutes && (
                      <Badge
                        variant={isTargetMet ? 'amber' : 'outline'}
                        className="text-xs gap-1"
                      >
                        <Target className="w-3 h-3" />
                        Meta: {activeSession.target_minutes} min
                        {isTargetMet && ' (Atingida!)'}
                      </Badge>
                    )}
                  </div>
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
                    {activeSession.title || 'Sessão de Trabalho'}
                  </h2>
                </div>

                {/* Sound alert toggle and previous session link */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`p-2 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                      soundEnabled
                        ? 'border-amber-200 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60'
                        : 'border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                    }`}
                    title={soundEnabled ? 'Alerta sonoro ativado' : 'Alerta sonoro desativado'}
                  >
                    {soundEnabled ? (
                      <>
                        <Bell className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        <span className="hidden sm:inline">Som Ativo</span>
                      </>
                    ) : (
                      <>
                        <BellOff className="w-3.5 h-3.5 text-neutral-400" />
                        <span className="hidden sm:inline">Mudo</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Continuation reference info if linked to previous session */}
              {activeSession.previous_session_id && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50/80 dark:bg-indigo-950/60 px-2.5 py-1 rounded-md border border-indigo-100 dark:border-indigo-800/50">
                  <Link2 className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Continuação da sessão:{' '}
                    <strong>
                      {activeSession.PreviousSession?.title ||
                        activeSession.previous_session?.title ||
                        activeSession.previous_session_id}
                    </strong>
                  </span>
                </div>
              )}

              {/* Client badge if linked */}
              {(activeSession.Client || activeSession.client) && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/60 px-2.5 py-1 rounded-md border border-emerald-100 dark:border-emerald-800/50 w-fit">
                  <Briefcase className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Cliente: <strong>{(activeSession.Client || activeSession.client)?.name}</strong>
                    {(activeSession.Client || activeSession.client)?.company && ` — ${(activeSession.Client || activeSession.client)?.company}`}
                  </span>
                </div>
              )}
            </CardHeader>

            <CardContent className="pt-6 pb-6 space-y-6">
              {/* Digital Clock Display */}
              <div className="flex flex-col items-center justify-center text-center py-2">
                <div
                  className={`text-5xl sm:text-7xl font-mono font-bold tracking-tight select-none transition-colors duration-300 ${
                    isTargetMet ? 'text-amber-500 dark:text-amber-400' : 'text-neutral-900 dark:text-neutral-100'
                  }`}
                >
                  {formatTimeHHMMSS(elapsedMs)}
                </div>

                {/* Sub-metrics: start time and billable amount */}
                <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-sm text-neutral-500 dark:text-neutral-400">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Início: {formatDateTime(activeSession.start_time)}</span>
                  </div>
                  <span className="text-neutral-300 dark:text-neutral-700">•</span>
                  <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                    <DollarSign className="w-4 h-4" />
                    <span>Faturamento Atual: {formatCurrency(currentBillable)}</span>
                    <span className="text-xs font-normal text-neutral-400">
                      ({decimalHours.toFixed(2)}h @ {formatCurrency(hourlyRate)}/h)
                    </span>
                  </div>
                </div>

                {/* Target Progress Bar */}
                {activeSession.target_minutes && activeSession.target_minutes > 0 && (
                  <div className="w-full max-w-md mt-5 space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-neutral-500 dark:text-neutral-400">Progresso da Meta</span>
                      <span className={isTargetMet ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-neutral-700 dark:text-neutral-300'}>
                        {progressPercent}% ({Math.round(elapsedMs / 60000)} / {activeSession.target_minutes} min)
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden border border-neutral-200 dark:border-neutral-700">
                      <div
                        className={`h-full transition-all duration-300 rounded-full ${
                          isTargetMet ? 'bg-amber-500' : 'bg-neutral-900 dark:bg-neutral-100'
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Stop Session Action Button */}
              <div className="flex justify-center pt-2">
                <Button
                  variant="destructive"
                  size="lg"
                  onClick={() => onStopSession(activeSession.id)}
                  disabled={loading}
                  className="px-8 font-semibold shadow-md gap-2"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>Finalizar Sessão de Trabalho</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* REAL-TIME TASKS & NOTES (RF05 & RF6.2) */}
          <Card className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs">
            <CardHeader className="pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                    Tarefas &amp; Anotações da Sessão
                  </CardTitle>
                  <CardDescription className="text-xs text-neutral-500 dark:text-neutral-400">
                    Adicione anotações em tempo real do que está sendo executado. Pressione Enter para salvar.
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {activeTasks.length} {activeTasks.length === 1 ? 'tarefa' : 'tarefas'}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-4">
              {/* Task Quick Input */}
              <form onSubmit={handleAddTaskSubmit} className="flex gap-2">
                <Input
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  placeholder="Ex: Refatoração do módulo de autenticação e testes unitários..."
                  className="flex-1 text-sm"
                  disabled={loading}
                  autoFocus
                />
                <Button
                  type="submit"
                  disabled={!taskInput.trim() || loading}
                  className="shrink-0 gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Adicionar</span>
                </Button>
              </form>

              {/* Real-time Task List (ul/li) */}
              {activeTasks.length > 0 ? (
                <ul className="divide-y divide-neutral-100 dark:divide-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-850/50">
                  {activeTasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-white dark:hover:bg-neutral-800"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                        <span className="text-neutral-800 dark:text-neutral-200 break-words leading-relaxed">
                          {task.description}
                        </span>
                      </div>
                      <button
                        onClick={() => onDeleteTask(task.id)}
                        className="p-1 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors shrink-0 cursor-pointer"
                        title="Remover anotação"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-6 text-neutral-400 dark:text-neutral-500 text-xs border border-dashed border-neutral-200 dark:border-neutral-800 rounded-lg">
                  Nenhuma tarefa registrada nesta sessão. Digite acima e pressione Enter.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        /* START NEW SESSION FORM */
        <Card className="border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0a0a0a] shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
              Iniciar Nova Sessão de Trabalho
            </CardTitle>
            <CardDescription className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Inicie o cronômetro gerido pelo servidor com objetivo de tempo e vínculo opcional a sessões anteriores.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleStart} className="space-y-6">
              {/* Session Title / Description */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  Título ou Descrição da Sessão
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Desenvolvimento da Feature de Faturamento"
                  className="text-sm font-medium text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400"
                />
              </div>

              {/* Target Minutes (RF04) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Objetivo de Tempo (Alerta quando atingido)</span>
                  </label>
                  <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    {customTarget
                      ? `${customTarget} minutos`
                      : targetMinutes
                      ? `${targetMinutes} minutos (${targetMinutes / 60}h)`
                      : 'Sem objetivo'}
                  </span>
                </div>

                {/* Quick preset chips */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Sem meta', val: null },
                    { label: '15m', val: 15 },
                    { label: '30m', val: 30 },
                    { label: '1 hora', val: 60 },
                    { label: '2 horas', val: 120 },
                    { label: '4 horas', val: 240 },
                  ].map((preset) => {
                    const isSelected =
                      !customTarget && targetMinutes === preset.val;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setCustomTarget('');
                          setTargetMinutes(preset.val);
                        }}
                        className={`px-3.5 py-2 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                          isSelected
                            ? 'border-neutral-900 dark:border-neutral-100 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 shadow-xs'
                            : 'border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Target Input */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Ou digite em minutos:</span>
                  <Input
                    type="number"
                    min="1"
                    max="1440"
                    placeholder="Ex: 45"
                    value={customTarget}
                    onChange={(e) => setCustomTarget(e.target.value)}
                    className="w-28 text-xs font-medium h-9 text-neutral-900 dark:text-neutral-100"
                  />
                </div>
              </div>

              {/* Session Continuation Banner (Inherited from History "Continuar") */}
              {resumeSession && (
                <div className="flex items-center justify-between p-3.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/60">
                  <div className="flex items-center gap-2.5 text-xs text-indigo-900 dark:text-indigo-200">
                    <Link2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <div>
                      <span className="font-semibold block">Continuação da sessão anterior:</span>
                      <span className="opacity-95 font-medium">{resumeSession.title} ({formatDateTime(resumeSession.start_time)})</span>
                    </div>
                  </div>
                  {onClearResumeSession && (
                    <button
                      type="button"
                      onClick={onClearResumeSession}
                      className="text-xs font-medium text-indigo-700 dark:text-indigo-300 hover:underline cursor-pointer"
                    >
                      Remover Vínculo
                    </button>
                  )}
                </div>
              )}

              {/* Client Selection (Autocomplete with debounce) */}
              <div className="space-y-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <label className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Vincular a Cliente / Projeto</span>
                </label>
                <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Pesquise e selecione o cliente para esta sessão (autocomplete com busca em tempo real).
                </p>
                <ClientAutocomplete
                  clients={clients}
                  selectedClientId={clientId}
                  onSelectClient={setClientId}
                  defaultHourlyRate={hourlyRate}
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2">
                <Button
                  type="submit"
                  size="lg"
                  disabled={loading}
                  className="w-full sm:w-auto px-8 gap-2 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 shadow-md font-semibold cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Iniciar Cronômetro</span>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
