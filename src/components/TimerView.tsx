import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  Pencil,
  Check,
  X,
  Sparkles,
  Loader2,
  FileText,
  GitCommit,
  ExternalLink,
  Link as LinkIcon,
  BookOpen,
  History,
} from 'lucide-react';
import dayjs from 'dayjs';
import { TimeSession, TaskItem, Client, Tenant } from '../types';
import { NotesView } from './NotesView';
import { RetroactiveTimePicker } from './RetroactiveTimePicker';
import {
  formatTimeHHMMSS,
  formatCurrency,
  formatDateTime,
  calculateElapsedMs,
} from '../utils/format';
import { playGoalChime } from '../utils/audio';
import { showNativeNotification } from '../lib/notifications';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { ClientAutocomplete } from './ClientAutocomplete';
import { Badge } from './ui/badge';
import { Dialog } from './ui/dialog';
import { TeamPulseWidget } from './TeamPulseWidget';
import { OnboardingChecklist } from './OnboardingChecklist';
import { useToast } from './ui/toast';
import { apiFetch } from '../utils/api';
import { GitCommitModal } from './GitCommitModal';
import { TaskLinkCard } from './TaskLinkCard';

interface TimerViewProps {
  activeSession: TimeSession | null;
  clients: Client[];
  hourlyRate: number;
  tenant?: Tenant | null;
  sessions?: TimeSession[];
  resumeSession?: TimeSession | null;
  onClearResumeSession?: () => void;
  onStartSession: (data: {
    title: string;
    notes?: string | null;
    target_minutes: number | null;
    previous_session_id: string | null;
    client_id: string | null;
    start_time?: string | null;
    retroactive_minutes?: number | null;
    retroactive_reason?: string | null;
  }) => Promise<void>;
  onStopSession: (sessionId: string, finalTitle?: string, finalNotes?: string) => Promise<void>;
  onUpdateSessionTitle?: (sessionId: string, title: string) => Promise<void>;
  onUpdateSessionNotes?: (sessionId: string, notes: string) => Promise<void>;
  onAddTask: (sessionId: string, description: string, notes?: string, link?: string | null) => Promise<void>;
  onUpdateTaskNotes?: (taskId: string, notes: string) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onRefreshData?: () => Promise<void>;
  onNavigateToSettings?: () => void;
  loading: boolean;
  currentUserId?: string;
  addToast?: (toast: { title: string; description: string; variant?: 'success' | 'destructive' | 'default' | 'amber' }) => void;
  onClientCreated?: (client: Client) => void;
  onNavigate?: (tab: 'clients' | 'reports' | 'timer' | 'settings') => void;
}

export function TimerView({
  activeSession,
  clients,
  hourlyRate,
  tenant,
  sessions = [],
  resumeSession,
  onClearResumeSession,
  onStartSession,
  onStopSession,
  onUpdateSessionTitle,
  onUpdateSessionNotes,
  onAddTask,
  onUpdateTaskNotes,
  onDeleteTask,
  onRefreshData,
  onNavigateToSettings,
  loading,
  currentUserId,
  addToast: parentAddToast,
  onClientCreated,
  onNavigate,
}: TimerViewProps) {
  const { addToast } = useToast();
  const effectiveAddToast = parentAddToast || addToast;
  const [isNotesDrawerOpen, setIsNotesDrawerOpen] = useState(false);

  // Git Commit Tasks extraction modal state
  const [gitModalOpen, setGitModalOpen] = useState(false);

  // Resilient elapsed time tracking (calculated from server start_time)
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [taskInput, setTaskInput] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Inline title editing state while timer is running
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [inlineTitle, setInlineTitle] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [isSuggestingTitle, setIsSuggestingTitle] = useState(false);

  // Stop session confirmation dialog state
  const [isStopModalOpen, setIsStopModalOpen] = useState(false);
  const [confirmStopTitle, setConfirmStopTitle] = useState('');
  const [confirmStopNotes, setConfirmStopNotes] = useState('');
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isSuggestingModalTitle, setIsSuggestingModalTitle] = useState(false);

  // Task inline observation editing state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskNotesValue, setTaskNotesValue] = useState<string>('');
  const [isSavingTaskNotes, setIsSavingTaskNotes] = useState(false);

  // Active session observation inline edit state
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [inlineNotes, setInlineNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // Keep inlineTitle and inlineNotes in sync with activeSession when not actively editing
  useEffect(() => {
    if (activeSession) {
      if (!isEditingTitle) {
        setInlineTitle(activeSession.title || '');
      }
      if (!isEditingNotes) {
        setInlineNotes(activeSession.notes || '');
      }
    }
  }, [activeSession?.title, activeSession?.notes, isEditingTitle, isEditingNotes]);

  // New session form state
  const [title, setTitle] = useState('');
  const [targetMinutes, setTargetMinutes] = useState<number | null>(() => {
    return tenant?.default_target_minutes !== undefined ? tenant.default_target_minutes : 60;
  });
  const [customTarget, setCustomTarget] = useState('');
  const [clientId, setClientId] = useState<string>('');

  // Retroactive session state (Clock-based)
  const [isRetroactive, setIsRetroactive] = useState(false);
  const [retroMinutes, setRetroMinutes] = useState<number>(15);
  const [retroTimeStr, setRetroTimeStr] = useState<string>('');
  const [retroStartTimeIso, setRetroStartTimeIso] = useState<string>('');
  const [retroIsValid, setRetroIsValid] = useState<boolean>(true);
  const [retroReason, setRetroReason] = useState<string>('');

  const maxAllowedRetroMinutes =
    tenant?.max_retroactive_minutes !== undefined && tenant?.max_retroactive_minutes !== null
      ? tenant.max_retroactive_minutes
      : 120;

  const [isAdvancedOpen, setIsAdvancedOpen] = useState(
    Boolean(targetMinutes || customTarget || resumeSession)
  );

  // Synchronize workspace default target when tenant loads/changes
  useEffect(() => {
    if (tenant?.default_target_minutes !== undefined) {
      setTargetMinutes(tenant.default_target_minutes);
    }
  }, [tenant?.default_target_minutes]);

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
  const clientDailyAlertTriggeredRef = useRef<boolean>(false);
  const activeSessionIdRef = useRef<string | null>(null);

  // Active Client & Daily Target Calculation (Calculated identically to Objetivo de Tempo)
  const activeClientId = activeSession?.client_id || (activeSession?.Client?.id ?? null);
  const runningClient = clients.find((c) => c.id === activeClientId) || activeSession?.Client || activeSession?.client;

  // Client daily target: specific client target or workspace default client target
  const clientDailyTargetMinutes = runningClient?.daily_target_minutes ?? (tenant?.default_client_daily_target_minutes ?? null);
  const clientDailyTargetMs = clientDailyTargetMinutes && clientDailyTargetMinutes > 0 ? clientDailyTargetMinutes * 60 * 1000 : null;

  // Accumulated completed time today for this client from other sessions
  const todayClientCompletedMs = useMemo(() => {
    if (!activeClientId || !sessions || sessions.length === 0) return 0;
    const todayStr = dayjs().format('YYYY-MM-DD');
    return sessions
      .filter((s) => {
        if (s.client_id !== activeClientId) return false;
        if (s.id === activeSession?.id) return false;
        if (!s.start_time) return false;
        return dayjs(s.start_time).format('YYYY-MM-DD') === todayStr;
      })
      .reduce((acc, s) => {
        if (s.metrics?.durationMs) return acc + s.metrics.durationMs;
        if (s.start_time && s.end_time) {
          return acc + Math.max(0, new Date(s.end_time).getTime() - new Date(s.start_time).getTime());
        }
        return acc;
      }, 0);
  }, [sessions, activeClientId, activeSession?.id]);

  // Reset alert trigger when active session changes
  useEffect(() => {
    if (activeSession?.id !== activeSessionIdRef.current) {
      activeSessionIdRef.current = activeSession?.id || null;
      alertTriggeredRef.current = false;
      clientDailyAlertTriggeredRef.current = false;
    }
  }, [activeSession?.id]);

  // Global shortcut triggers listener (Alt + S / Shift + Space)
  useEffect(() => {
    const handleOpenStop = () => {
      if (activeSession) {
        setConfirmStopTitle(activeSession.title || '');
        setConfirmStopNotes(activeSession.notes || '');
        setIsStopModalOpen(true);
      }
    };

    const handleTriggerStart = () => {
      if (!activeSession) {
        const formEl = document.getElementById('new-session-form') as HTMLFormElement | null;
        if (formEl) {
          formEl.requestSubmit();
        } else {
          onStartSession({
            title: title.trim() || 'Nova Sessão',
            notes: null,
            target_minutes: targetMinutes,
            previous_session_id: resumeSession?.id || null,
            client_id: clientId || null,
          });
        }
      }
    };

    window.addEventListener('cronos:open-stop-modal', handleOpenStop);
    window.addEventListener('cronos:trigger-start-timer', handleTriggerStart);
    return () => {
      window.removeEventListener('cronos:open-stop-modal', handleOpenStop);
      window.removeEventListener('cronos:trigger-start-timer', handleTriggerStart);
    };
  }, [activeSession, title, targetMinutes, resumeSession?.id, clientId, onStartSession]);

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

      // Check session target alert (RF04)
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
          showNativeNotification('🎯 Meta de tempo atingida!', {
            body: `Você completou o objetivo de ${activeSession.target_minutes} minutos na sessão "${activeSession.title || 'Trabalho'}".`,
          });
        }
      }

      // Check client daily target alert (calculado da mesma forma que Objetivo de Tempo)
      if (clientDailyTargetMs && clientDailyTargetMinutes && clientDailyTargetMinutes > 0) {
        const totalClientMsNow = todayClientCompletedMs + currentElapsed;
        if (totalClientMsNow >= clientDailyTargetMs && !clientDailyAlertTriggeredRef.current) {
          clientDailyAlertTriggeredRef.current = true;
          if (soundEnabled) {
            playGoalChime();
          }
          const clientDisplayName = runningClient?.name || 'Cliente';
          addToast({
            title: '🎯 Meta diária do cliente atingida!',
            description: `Você completou a meta diária de ${clientDailyTargetMinutes} minutos hoje para ${clientDisplayName}.`,
            variant: 'amber',
          });
          showNativeNotification('🎯 Meta diária do cliente atingida!', {
            body: `Você completou a meta diária de ${clientDailyTargetMinutes} minutos hoje para "${clientDisplayName}".`,
          });
        }
      }
    };

    // Initial update
    updateTimer();

    // 1-second interval for clock display
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeSession, soundEnabled, addToast, clientDailyTargetMs, clientDailyTargetMinutes, todayClientCompletedMs, runningClient?.name]);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isRetroactive) {
      if (maxAllowedRetroMinutes === 0) {
        effectiveAddToast({
          title: 'Início retroativo desativado',
          description: 'O início retroativo de cronômetro está desativado pelo dono do workspace.',
          variant: 'destructive',
        });
        return;
      }
      if (!retroIsValid || !retroMinutes || retroMinutes <= 0) {
        effectiveAddToast({
          title: 'Horário retroativo inválido',
          description: 'Por favor, selecione no relógio um horário válido anterior ao momento atual.',
          variant: 'destructive',
        });
        return;
      }
      if (retroMinutes > maxAllowedRetroMinutes) {
        effectiveAddToast({
          title: 'Limite excedido',
          description: `O tempo máximo retroativo permitido neste workspace é de ${maxAllowedRetroMinutes} minutos (${(maxAllowedRetroMinutes / 60).toFixed(1)}h). O horário selecionado corresponde a ${retroMinutes} minutos atrás.`,
          variant: 'destructive',
        });
        return;
      }
      if (!retroReason.trim()) {
        effectiveAddToast({
          title: 'Motivo obrigatório',
          description: 'É obrigatório informar o motivo para o início retroativo (ex: "esqueci de iniciar o timer ao iniciar o desenvolvimento").',
          variant: 'destructive',
        });
        return;
      }
    }

    const finalTarget = customTarget ? Number(customTarget) : targetMinutes;
    await onStartSession({
      title: title.trim(),
      notes: null,
      target_minutes: finalTarget && finalTarget > 0 ? finalTarget : null,
      previous_session_id: resumeSession ? resumeSession.id : null,
      client_id: clientId ? clientId : null,
      start_time: isRetroactive && retroStartTimeIso ? retroStartTimeIso : null,
      retroactive_minutes: isRetroactive ? Number(retroMinutes) : null,
      retroactive_reason: isRetroactive ? retroReason.trim() : null,
    });
    setTitle('');
    setCustomTarget('');
    setClientId('');
    setIsRetroactive(false);
    setRetroMinutes(15);
    setRetroTimeStr('');
    setRetroStartTimeIso('');
    setRetroReason('');
    if (onClearResumeSession) onClearResumeSession();
  };

  const handleSaveInlineNotes = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeSession || !onUpdateSessionNotes) return;
    try {
      setIsSavingNotes(true);
      await onUpdateSessionNotes(activeSession.id, inlineNotes.trim());
      setIsEditingNotes(false);
    } catch {
      // Toast handled by parent
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleAddTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession || !taskInput.trim() || loading) return;
    const desc = taskInput.trim();
    setTaskInput('');
    await onAddTask(activeSession.id, desc);
  };

  const handleSaveInlineTitle = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeSession || !onUpdateSessionTitle) return;
    const trimmed = inlineTitle.trim() || 'Sessão de Trabalho';
    try {
      setIsSavingTitle(true);
      await onUpdateSessionTitle(activeSession.id, trimmed);
      setIsEditingTitle(false);
    } catch {
      // Toast handled by parent
    } finally {
      setIsSavingTitle(false);
    }
  };

  const handleCancelInlineTitle = () => {
    setInlineTitle(activeSession?.title || '');
    setIsEditingTitle(false);
  };

  const handleSuggestTitleFromTasks = async (target: 'inline' | 'modal') => {
    if (!activeSession) return;
    const tasks = (activeSession.Tasks || activeSession.tasks || [])
      .map((t) => t.description)
      .filter(Boolean);

    if (tasks.length === 0) {
      addToast({
        title: 'Nenhuma tarefa registrada',
        description: 'Adicione pelo menos uma tarefa abaixo para que o modelo de IA possa sugerir um título com base nelas.',
        variant: 'amber',
      });
      return;
    }

    const setLoader = target === 'inline' ? setIsSuggestingTitle : setIsSuggestingModalTitle;
    try {
      setLoader(true);
      const res = await apiFetch('/api/ai/suggest-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSession.id,
          tasks,
          currentTitle: target === 'inline' ? inlineTitle : confirmStopTitle,
          clientName: (activeSession.Client || activeSession.client)?.name,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Não foi possível obter a sugestão da IA');
      }

      const data = await res.json();
      if (data.suggestedTitle) {
        if (target === 'inline') {
          setInlineTitle(data.suggestedTitle);
        } else {
          setConfirmStopTitle(data.suggestedTitle);
        }
        addToast({
          title: 'Título sugerido pela IA!',
          description: `"${data.suggestedTitle}" baseado em ${data.tasksCount || tasks.length} tarefa(s).`,
          variant: 'success',
        });
      }
    } catch (err: any) {
      addToast({
        title: 'Erro ao sugerir título',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoader(false);
    }
  };

  // Target calculations
  const targetMs = activeSession?.target_minutes
    ? activeSession.target_minutes * 60 * 1000
    : null;
  const isTargetMet = targetMs ? elapsedMs >= targetMs : false;
  const progressPercent = targetMs
    ? Math.min(100, Math.round((elapsedMs / targetMs) * 100))
    : 0;

  // Client Daily Target calculations (identicamente ao Objetivo de Tempo)
  const todayClientTotalMs = todayClientCompletedMs + (activeClientId ? elapsedMs : 0);
  const isClientDailyTargetMet = clientDailyTargetMs ? todayClientTotalMs >= clientDailyTargetMs : false;
  const clientDailyProgressPercent = clientDailyTargetMs
    ? Math.min(100, Math.round((todayClientTotalMs / clientDailyTargetMs) * 100))
    : 0;

  // Stopped timer client daily target preview
  const selectedClient = clients.find((c) => c.id === clientId);
  const selectedClientDailyTargetMinutes = selectedClient?.daily_target_minutes ?? (tenant?.default_client_daily_target_minutes ?? null);
  const todaySelectedClientCompletedMs = useMemo(() => {
    if (!clientId || !sessions || sessions.length === 0) return 0;
    const todayStr = dayjs().format('YYYY-MM-DD');
    return sessions
      .filter((s) => {
        if (s.client_id !== clientId) return false;
        if (!s.start_time) return false;
        return dayjs(s.start_time).format('YYYY-MM-DD') === todayStr;
      })
      .reduce((acc, s) => {
        if (s.metrics?.durationMs) return acc + s.metrics.durationMs;
        if (s.start_time && s.end_time) {
          return acc + Math.max(0, new Date(s.end_time).getTime() - new Date(s.start_time).getTime());
        }
        return acc;
      }, 0);
  }, [sessions, clientId]);
  const selectedClientDailyTargetMs = selectedClientDailyTargetMinutes && selectedClientDailyTargetMinutes > 0 ? selectedClientDailyTargetMinutes * 60 * 1000 : null;
  const selectedClientProgressPercent = selectedClientDailyTargetMs
    ? Math.min(100, Math.round((todaySelectedClientCompletedMs / selectedClientDailyTargetMs) * 100))
    : 0;
  const isSelectedClientDailyTargetMet = selectedClientDailyTargetMs ? todaySelectedClientCompletedMs >= selectedClientDailyTargetMs : false;

  // Real-time billable value (using client custom rate if available)
  const activeClient = activeSession?.Client || activeSession?.client;
  const sessionHourlyRate = activeClient?.hourly_rate ?? hourlyRate;
  const decimalHours = elapsedMs / 3600000;
  const currentBillable = decimalHours * sessionHourlyRate;

  // Tasks of active session
  const activeTasks: TaskItem[] = activeSession?.Tasks || activeSession?.tasks || [];

  return (
    <div className="space-y-6">
      <OnboardingChecklist
        clientsCount={clients.length}
        sessionsCount={sessions.length}
        onNavigate={onNavigate || (() => {})}
      />
      <TeamPulseWidget />

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
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      Sessão em Andamento
                    </span>
                  </div>

                  {activeSession.target_minutes && (
                    <div className="flex items-center">
                      <Badge
                        variant={isTargetMet ? 'amber' : 'outline'}
                        className="text-xs gap-1"
                      >
                        <Target className="w-3 h-3" />
                        Meta: {activeSession.target_minutes} min
                        {isTargetMet && ' (Atingida!)'}
                      </Badge>
                    </div>
                  )}

                  {clientDailyTargetMinutes && clientDailyTargetMinutes > 0 && (
                    <div className="flex items-center">
                      <Badge
                        variant={isClientDailyTargetMet ? 'amber' : 'outline'}
                        className={`text-xs gap-1 ${
                          isClientDailyTargetMet
                            ? 'border-amber-400 bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 font-semibold'
                            : 'border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
                        }`}
                      >
                        <Target className="w-3 h-3 text-indigo-500" />
                        Meta Diária ({runningClient?.name || 'Cliente'}): {clientDailyTargetMinutes} min
                        {isClientDailyTargetMet && ' (Atingida!)'}
                      </Badge>
                    </div>
                  )}

                  {/* Retroactive Session Badge */}
                  {activeSession.is_retroactive ? (
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <Badge
                        variant="outline"
                        className="text-xs gap-1.5 border-purple-300 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-medium"
                      >
                        <History className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                        <span>Início Retroativo ({activeSession.retroactive_minutes || 0}m atrás)</span>
                      </Badge>
                      {activeSession.retroactive_reason && (
                        <span className="text-2xs text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/30 px-2 py-0.5 rounded border border-purple-200/60 dark:border-purple-850/60 italic font-medium">
                          Motivo: "{activeSession.retroactive_reason}"
                        </span>
                      )}
                    </div>
                  ) : null}

                  {/* Title View or Inline Edit */}
                  {isEditingTitle ? (
                    <form
                      onSubmit={handleSaveInlineTitle}
                      className="flex items-center gap-2 max-w-xl w-full pt-1 flex-wrap sm:flex-nowrap"
                    >
                      <Input
                        value={inlineTitle}
                        onChange={(e) => setInlineTitle(e.target.value)}
                        className="text-sm sm:text-base font-semibold h-9 flex-1 min-w-[200px]"
                        placeholder="Digite o título da sessão..."
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            handleCancelInlineTitle();
                          }
                        }}
                      />
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          type="submit"
                          size="sm"
                          variant="default"
                          className="h-9 px-3 gap-1 cursor-pointer"
                          disabled={isSavingTitle}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Salvar</span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleSuggestTitleFromTasks('inline')}
                          disabled={isSuggestingTitle}
                          className="h-9 px-2.5 gap-1.5 text-xs font-medium border-indigo-200 dark:border-indigo-800/70 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 cursor-pointer"
                          title="Chama o modelo de IA para sugerir um título com base nas tarefas registradas"
                        >
                          {isSuggestingTitle ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600 dark:text-indigo-400" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          )}
                          <span className="whitespace-nowrap">Sugerir com base em tarefas</span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={handleCancelInlineTitle}
                          className="h-9 px-2.5 cursor-pointer text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                          title="Cancelar edição"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center gap-2 group flex-wrap">
                      <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
                        {activeSession.title || 'Sessão de Trabalho'}
                      </h2>
                      {onUpdateSessionTitle && (
                        <button
                          type="button"
                          onClick={() => {
                            setInlineTitle(activeSession.title || '');
                            setIsEditingTitle(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-md transition-colors cursor-pointer"
                          title="Alterar título da sessão em andamento"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Alterar título</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Sound alert toggle, notes drawer button and previous session link */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsNotesDrawerOpen(true)}
                    className="px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    title="Abrir gaveta lateral de notas"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span className="hidden sm:inline">Notas & TODO</span>
                  </button>
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

              {/* Session Observation/Notes */}
              {activeSession.notes ? (
                <div className="mt-2.5 text-xs text-amber-950 dark:text-amber-200 bg-amber-50/90 dark:bg-amber-950/60 p-3 rounded-lg border border-amber-200/80 dark:border-amber-800/60 shadow-2xs">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="flex items-center gap-1.5 font-semibold text-2xs uppercase tracking-wider text-amber-800 dark:text-amber-300">
                      <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      Observações da Sessão (Timer)
                    </span>
                    {onUpdateSessionNotes && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingNotes(!isEditingNotes);
                          setInlineNotes(activeSession.notes || '');
                        }}
                        className="text-2xs font-medium text-amber-800 dark:text-amber-300 hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>{isEditingNotes ? 'Cancelar' : 'Editar Observação'}</span>
                      </button>
                    )}
                  </div>
                  {isEditingNotes ? (
                    <form onSubmit={handleSaveInlineNotes} className="space-y-2 mt-1">
                      <textarea
                        value={inlineNotes}
                        onChange={(e) => setInlineNotes(e.target.value)}
                        placeholder="Observações da sessão..."
                        rows={3}
                        className="w-full text-xs p-2 rounded-md border border-amber-300 dark:border-amber-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                      />
                      <div className="flex justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsEditingNotes(false)}
                          className="h-6 text-2xs px-2 cursor-pointer"
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="submit"
                          size="sm"
                          disabled={isSavingNotes}
                          className="h-6 text-2xs px-2.5 bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
                        >
                          {isSavingNotes ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          <span className="ml-1">Salvar</span>
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <p className="whitespace-pre-wrap leading-relaxed text-neutral-800 dark:text-neutral-200 text-xs">
                      {activeSession.notes}
                    </p>
                  )}
                </div>
              ) : onUpdateSessionNotes ? (
                <div className="mt-2">
                  {isEditingNotes ? (
                    <form onSubmit={handleSaveInlineNotes} className="space-y-2 p-3 rounded-lg border border-amber-200/80 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/40">
                      <label className="text-2xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-amber-600" />
                        <span>Adicionar Observação da Sessão:</span>
                      </label>
                      <textarea
                        value={inlineNotes}
                        onChange={(e) => setInlineNotes(e.target.value)}
                        placeholder="Observações ou anotações contextuais da sessão de trabalho..."
                        rows={3}
                        className="w-full text-xs p-2.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        autoFocus
                      />
                      <div className="flex justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsEditingNotes(false)}
                          className="h-6 text-2xs px-2 cursor-pointer"
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="submit"
                          size="sm"
                          disabled={isSavingNotes}
                          className="h-6 text-2xs px-2.5 bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
                        >
                          {isSavingNotes ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          <span className="ml-1">Salvar Observação</span>
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setInlineNotes('');
                        setIsEditingNotes(true);
                      }}
                      className="inline-flex items-center gap-1.5 text-2xs font-medium text-neutral-500 hover:text-amber-700 dark:hover:text-amber-300 transition-colors cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-amber-500" />
                      <span>+ Adicionar observação da sessão de timer</span>
                    </button>
                  )}
                </div>
              ) : null}
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
                <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Início: {formatDateTime(activeSession.start_time)}</span>
                  </div>
                  <span className="text-neutral-300 dark:text-neutral-700">•</span>
                  <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Faturamento Atual: {formatCurrency(currentBillable)}</span>
                    <span className="text-2xs font-normal text-neutral-400">
                      ({decimalHours.toFixed(2)}h @ {formatCurrency(hourlyRate)}/h)
                    </span>
                  </div>
                </div>

                {/* Target Progress Bar */}
                {activeSession.target_minutes && activeSession.target_minutes > 0 && (
                  <div className="w-full max-w-md mt-5 space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-neutral-500 dark:text-neutral-400">Progresso da Meta da Sessão</span>
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

                {/* Client Daily Target Progress Bar (Calculado da mesma forma que Objetivo de Tempo) */}
                {clientDailyTargetMinutes && clientDailyTargetMinutes > 0 && (
                  <div className="w-full max-w-md mt-4 space-y-1.5 p-3 rounded-lg border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-indigo-950 dark:text-indigo-200 font-semibold flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        Meta Diária ({runningClient?.name || 'Cliente'}):
                      </span>
                      <span className={isClientDailyTargetMet ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-neutral-700 dark:text-neutral-300'}>
                        {clientDailyProgressPercent}% ({Math.round(todayClientTotalMs / 60000)} / {clientDailyTargetMinutes} min)
                      </span>
                    </div>
                    <div className="h-2 w-full bg-indigo-100 dark:bg-neutral-800 rounded-full overflow-hidden border border-indigo-200/70 dark:border-neutral-700">
                      <div
                        className={`h-full transition-all duration-300 rounded-full ${
                          isClientDailyTargetMet ? 'bg-amber-500' : 'bg-indigo-600 dark:bg-indigo-400'
                        }`}
                        style={{ width: `${clientDailyProgressPercent}%` }}
                      />
                    </div>
                    {isClientDailyTargetMet && (
                      <p className="text-2xs text-amber-700 dark:text-amber-400 font-semibold text-right">
                        🎯 Meta diária do cliente atingida com sucesso hoje!
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Stop Session Action Button */}
              <div className="flex flex-col items-center justify-center pt-2 gap-2">
                <Button
                  variant="destructive"
                  size="lg"
                  onClick={() => {
                    setConfirmStopTitle(activeSession.title || '');
                    setConfirmStopNotes(activeSession.notes || '');
                    setIsStopModalOpen(true);
                  }}
                  disabled={loading}
                  className="px-8 font-semibold shadow-md gap-2.5 cursor-pointer"
                  title="Finalizar Sessão de Trabalho (Atalho: Alt + S ou Shift + Espaço)"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>Finalizar Sessão de Trabalho</span>
                  <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-2xs font-mono font-medium rounded bg-red-800/60 text-red-200 border border-red-700/60">
                    Alt+S
                  </kbd>
                </Button>
                <p className="text-2xs text-neutral-400 dark:text-neutral-500 text-center">
                  Dica: Pressione <kbd className="font-mono text-2xs px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">Alt + S</kbd> ou <kbd className="font-mono text-2xs px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">Shift + Espaço</kbd> para finalizar
                </p>
              </div>
            </CardContent>
          </Card>

          {/* REAL-TIME TASKS & NOTES (RF05 & RF6.2) */}
          <Card className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs">
            <CardHeader className="pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex flex-col gap-2.5">
                <div>
                  <CardTitle className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                    Tarefas &amp; Anotações da Sessão
                  </CardTitle>
                </div>
                <div>
                  <CardDescription className="text-xs text-neutral-500 dark:text-neutral-400">
                    Adicione anotações em tempo real do que está sendo executado. Pressione Enter para salvar.
                  </CardDescription>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-neutral-100 dark:border-neutral-800/60">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setGitModalOpen(true)}
                    className="h-8 gap-1.5 text-xs border-indigo-200 dark:border-indigo-800/70 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 cursor-pointer"
                    title="Importar ou sugerir tarefas a partir de commits do Git / GitHub com IA"
                  >
                    <GitCommit className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Importar de Commits (Git)</span>
                  </Button>
                  <Badge variant="secondary" className="text-xs">
                    {activeTasks.length} {activeTasks.length === 1 ? 'tarefa' : 'tarefas'}
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-4">
              {/* Task Quick Input */}
              <form onSubmit={handleAddTaskSubmit} className="flex gap-2">
                <Input
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  placeholder="Ex: Refatoração do módulo de autenticação e testes unitários..."
                  className="flex-1 text-xs"
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

              {/* Real-time Task List (ul/li) with click-to-edit observations */}
              {activeTasks.length > 0 ? (
                <ul className="divide-y divide-neutral-100 dark:divide-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-850/50">
                  {activeTasks.map((task) => {
                    const isEditingThisTask = editingTaskId === task.id;
                    const hasNotes = Boolean(task.notes && task.notes.trim());

                    return (
                      <li
                        key={task.id}
                        className="transition-colors hover:bg-white dark:hover:bg-neutral-800 px-4 py-3 text-xs space-y-2.5"
                      >
                        {/* Task Header / Description */}
                        <div
                          className="flex items-start gap-2.5 cursor-pointer group"
                          onClick={() => {
                            if (isEditingThisTask) {
                              setEditingTaskId(null);
                            } else {
                              setEditingTaskId(task.id);
                              setTaskNotesValue(task.notes || '');
                            }
                          }}
                          title="Clique nesta tarefa para preencher ou visualizar observações"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <span className="text-neutral-900 dark:text-neutral-100 break-words leading-relaxed group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors font-medium text-sm">
                              {task.description}
                            </span>
                          </div>
                        </div>

                        {/* Link Metadata Card if notes contain a link */}
                        <TaskLinkCard notes={task.notes} link={task.link} />

                        {/* Secondary Row: Badges / Links & Action buttons in new lines */}
                        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-neutral-100 dark:border-neutral-800/60">
                          <div className="flex items-center gap-2 flex-wrap">
                            {task.link && (
                              <a
                                href={task.link}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1.5 text-2xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shadow-2xs hover:bg-indigo-100 dark:hover:bg-indigo-900/80 transition-colors"
                                title={`Abrir commit no repositório: ${task.link}`}
                              >
                                <ExternalLink className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                                <span>Commit</span>
                              </a>
                            )}
                            {hasNotes ? (
                              <span
                                onClick={() => {
                                  if (isEditingThisTask) {
                                    setEditingTaskId(null);
                                  } else {
                                    setEditingTaskId(task.id);
                                    setTaskNotesValue(task.notes || '');
                                  }
                                }}
                                className="inline-flex items-center gap-1.5 text-2xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shadow-2xs cursor-pointer hover:bg-amber-100 transition-colors"
                              >
                                <FileText className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                <span>Observação registrada (clique para ver/editar)</span>
                              </span>
                            ) : (
                              <span
                                onClick={() => {
                                  if (isEditingThisTask) {
                                    setEditingTaskId(null);
                                  } else {
                                    setEditingTaskId(task.id);
                                    setTaskNotesValue(task.notes || '');
                                  }
                                }}
                                className="inline-flex items-center gap-1.5 text-2xs text-neutral-500 dark:text-neutral-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors cursor-pointer"
                              >
                                <FileText className="w-3 h-3 text-neutral-400" />
                                <span>+ Adicionar observação</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              onClick={() => onDeleteTask(task.id)}
                              className="h-8 px-2.5 text-2xs font-medium rounded-md inline-flex items-center justify-center gap-1.5 text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 border border-red-200 dark:border-red-800 transition-colors cursor-pointer shrink-0"
                              title="Remover tarefa"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Excluir</span>
                            </button>
                          </div>
                        </div>

                        {/* Inline Task Observation Editor (opens ONLY when clicked on the task) */}
                        {isEditingThisTask && (
                          <div className="px-4 pb-3 pt-2 bg-amber-50/50 dark:bg-amber-950/30 border-t border-amber-100 dark:border-amber-900/40 space-y-2">
                            {task.link && (
                              <div className="flex items-center gap-1.5 text-2xs text-neutral-600 dark:text-neutral-300 bg-white dark:bg-neutral-900 px-2.5 py-1.5 rounded border border-indigo-200 dark:border-indigo-800/80">
                                <LinkIcon className="w-3 h-3 text-indigo-500 shrink-0" />
                                <span className="font-semibold text-neutral-500 dark:text-neutral-400">Link do Commit:</span>
                                <a
                                  href={task.link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-indigo-600 dark:text-indigo-400 hover:underline font-mono truncate flex-1"
                                >
                                  {task.link}
                                </a>
                                <a
                                  href={task.link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-indigo-600 dark:text-indigo-400 p-0.5 hover:bg-indigo-50 rounded"
                                  title="Abrir commit em nova aba"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            )}
                            <div className="space-y-2">
                              <label className="flex items-center gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200">
                                <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                <span>Observações da Tarefa:</span>
                              </label>
                              <textarea
                                value={taskNotesValue}
                                onChange={(e) => setTaskNotesValue(e.target.value)}
                                placeholder="Digite observações detalhadas sobre esta tarefa (ex: arquivos alterados, links de PRs, detalhes técnicos, pendências)..."
                                rows={3}
                                autoFocus
                                className="w-full text-xs p-2.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                              />
                              {/* Live preview of links while editing notes */}
                              <TaskLinkCard notes={taskNotesValue} />
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingTaskId(null)}
                                  className="h-7 text-xs px-2.5 cursor-pointer"
                                >
                                  Cancelar
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={isSavingTaskNotes}
                                  onClick={async () => {
                                    if (!onUpdateTaskNotes) return;
                                    try {
                                      setIsSavingTaskNotes(true);
                                      await onUpdateTaskNotes(task.id, taskNotesValue.trim());
                                      setEditingTaskId(null);
                                    } finally {
                                      setIsSavingTaskNotes(false);
                                    }
                                  }}
                                  className="h-7 text-xs px-3 gap-1 bg-amber-600 hover:bg-amber-700 text-white font-medium cursor-pointer"
                                >
                                  {isSavingTaskNotes ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Check className="w-3 h-3" />
                                  )}
                                  <span>Salvar Observação</span>
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
                  Iniciar Nova Sessão de Trabalho
                </CardTitle>
                <CardDescription className="text-xs text-neutral-500 dark:text-neutral-400">
                  Inicie o cronômetro gerido pelo servidor com objetivo de tempo e vínculo opcional a sessões anteriores.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsNotesDrawerOpen(true)}
                  className="h-8 px-2.5 gap-1.5 text-xs font-medium border border-indigo-200 dark:border-indigo-800/70 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-md transition-colors inline-flex items-center cursor-pointer shadow-xs"
                  title="Abrir gaveta lateral de notas"
                >
                  <BookOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Notas & TODO</span>
                </button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setGitModalOpen(true)}
                  className="h-8 gap-1.5 text-xs border-indigo-200 dark:border-indigo-800/70 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 cursor-pointer"
                  title="Extrair tarefas de commits do Git e iniciar sessão com tarefas já aprovadas"
                >
                  <GitCommit className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Importar Commits (Git)</span>
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <form id="new-session-form" onSubmit={handleStart} className="space-y-6">
              {/* Session Title / Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Título ou Descrição da Sessão
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Desenvolvimento da Feature de Faturamento"
                  className="text-xs font-medium text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400"
                />
              </div>

              {/* Client Selection (Autocomplete with debounce) */}
              <div className="space-y-2 pt-1">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Vincular a Cliente / Projeto</span>
                </label>
                <p className="text-2xs text-neutral-500 dark:text-neutral-400">
                  Pesquise e selecione o cliente para esta sessão (autocomplete com busca em tempo real).
                </p>
                <ClientAutocomplete
                  clients={clients}
                  selectedClientId={clientId}
                  onSelectClient={setClientId}
                  defaultHourlyRate={hourlyRate}
                  onClientCreated={onClientCreated}
                />

                {/* Selected Client Daily Target Status Preview */}
                {selectedClient && selectedClientDailyTargetMinutes && selectedClientDailyTargetMinutes > 0 ? (
                  <div className="mt-2 p-3 rounded-lg border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/60 dark:bg-indigo-950/30 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-indigo-900 dark:text-indigo-200 font-semibold flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        Meta Diária para {selectedClient.name}:
                      </span>
                      <span className={isSelectedClientDailyTargetMet ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-neutral-700 dark:text-neutral-300'}>
                        {selectedClientProgressPercent}% ({Math.round(todaySelectedClientCompletedMs / 60000)} / {selectedClientDailyTargetMinutes} min hoje)
                      </span>
                    </div>
                    <div className="h-2 w-full bg-indigo-100 dark:bg-neutral-800 rounded-full overflow-hidden border border-indigo-200/70 dark:border-neutral-700">
                      <div
                        className={`h-full transition-all duration-300 rounded-full ${
                          isSelectedClientDailyTargetMet ? 'bg-amber-500' : 'bg-indigo-600 dark:bg-indigo-400'
                        }`}
                        style={{ width: `${selectedClientProgressPercent}%` }}
                      />
                    </div>
                    {isSelectedClientDailyTargetMet ? (
                      <p className="text-2xs text-amber-700 dark:text-amber-400 font-medium">
                        ✓ Meta diária já cumprida hoje para este cliente!
                      </p>
                    ) : (
                      <p className="text-2xs text-neutral-500 dark:text-neutral-400">
                        Resta {Math.max(0, selectedClientDailyTargetMinutes - Math.round(todaySelectedClientCompletedMs / 60000))} minutos para completar a meta de hoje.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Retroactive Timer Start Option */}
              <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-850/60 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      id="retroactive-toggle"
                      checked={isRetroactive}
                      onChange={(e) => {
                        if (maxAllowedRetroMinutes === 0 && e.target.checked) {
                          effectiveAddToast({
                            title: 'Recurso Desativado',
                            description: 'O início retroativo foi desativado nas configurações deste workspace.',
                            variant: 'destructive',
                          });
                          return;
                        }
                        setIsRetroactive(e.target.checked);
                      }}
                      disabled={maxAllowedRetroMinutes === 0}
                      className="w-4 h-4 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-50"
                    />
                    <div className="flex items-center gap-1.5">
                      <History className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span className={`text-xs font-semibold ${maxAllowedRetroMinutes === 0 ? 'text-neutral-400 dark:text-neutral-500' : 'text-neutral-800 dark:text-neutral-200'}`}>
                        Iniciar a partir de um tempo anterior (Retroativo)
                      </span>
                    </div>
                  </label>

                  <Badge
                    variant="outline"
                    className="text-3xs font-mono text-neutral-600 dark:text-neutral-400 border-neutral-300 dark:border-neutral-700"
                  >
                    {maxAllowedRetroMinutes === 0 ? 'Desativado' : `Limite: ${maxAllowedRetroMinutes}m`}
                  </Badge>
                </div>

                {maxAllowedRetroMinutes === 0 && (
                  <p className="text-2xs text-amber-600 dark:text-amber-400">
                    O administrador/dono do workspace desativou o início retroativo nas configurações.
                  </p>
                )}

                {isRetroactive && maxAllowedRetroMinutes > 0 && (
                  <div className="space-y-4 pt-2 border-t border-neutral-200 dark:border-neutral-700/80 animate-in fade-in-50 duration-200">
                    <RetroactiveTimePicker
                      maxAllowedMinutes={maxAllowedRetroMinutes}
                      onTimeChange={({ selectedTimeStr, calculatedMinutes, isValid, startTimeIso }) => {
                        setRetroTimeStr(selectedTimeStr);
                        setRetroMinutes(calculatedMinutes);
                        setRetroIsValid(isValid);
                        setRetroStartTimeIso(startTimeIso);
                      }}
                    />

                    {/* Mandatory Reason */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                          Motivo do Início Retroativo <span className="text-red-500">*</span>
                        </label>
                        <span className="text-3xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 px-1.5 py-0.5 rounded border border-red-200 dark:border-red-900/60">
                          Obrigatório
                        </span>
                      </div>
                      <Input
                        value={retroReason}
                        onChange={(e) => setRetroReason(e.target.value)}
                        placeholder="Ex: Esqueci de iniciar o timer ao começar a reunião"
                        className={`text-xs ${
                          !retroReason.trim()
                            ? 'border-amber-400 dark:border-amber-600 focus:border-red-500'
                            : 'border-emerald-400 dark:border-emerald-600'
                        }`}
                      />
                      <p className="text-2xs text-neutral-500 dark:text-neutral-400">
                        O motivo e o horário de início serão registrados no histórico e relatórios para auditoria.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Progressive Disclosure Toggle for Advanced Options */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 cursor-pointer py-1.5 px-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/80 transition-colors shadow-2xs"
                >
                  <span>⚙️ Opções Avançadas & Metas de Tempo</span>
                  <span className="text-2xs px-1.5 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-mono">
                    {targetMinutes || customTarget || resumeSession ? '1 ativa' : 'opcional'}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isAdvancedOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Collapsible Advanced Options Section */}
              {isAdvancedOpen && (
                <div className="space-y-6 pt-3 pb-1 border-t border-neutral-200 dark:border-neutral-800 animate-in fade-in-50 duration-200">
                  {/* Target Minutes (RF04) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
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
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
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
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-3">
                <Button
                  type="submit"
                  size="lg"
                  disabled={loading}
                  className="w-full sm:w-auto px-8 gap-2.5 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 shadow-md font-semibold cursor-pointer"
                  title="Iniciar Cronômetro (Atalho: Alt + S ou Shift + Espaço)"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Iniciar Cronômetro</span>
                </Button>
                <span className="text-2xs text-neutral-500 dark:text-neutral-400">
                  Dica: Pressione <kbd className="font-mono text-2xs px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">Alt + S</kbd> ou <kbd className="font-mono text-2xs px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">Shift + Espaço</kbd> para iniciar
                </span>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Confirmation & Title Review Dialog before Finalizing Session */}
      <Dialog
        open={isStopModalOpen}
        onOpenChange={(open) => {
          if (!isFinalizing) {
            setIsStopModalOpen(open);
          }
        }}
        title="Finalizar Sessão de Trabalho"
        description="Confirme os detalhes e o título da sessão antes de registrar no histórico e relatórios."
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!activeSession) return;
            const finalTitle = confirmStopTitle.trim() || activeSession.title || 'Sessão de Trabalho';
            const finalNotes = confirmStopNotes.trim();
            try {
              setIsFinalizing(true);
              await onStopSession(activeSession.id, finalTitle, finalNotes);
              setIsStopModalOpen(false);
            } finally {
              setIsFinalizing(false);
            }
          }}
          className="space-y-4 pt-1"
        >
          {/* Quick Metrics Summary */}
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-850/60 p-3.5 space-y-2 text-xs text-neutral-600 dark:text-neutral-300">
            <div className="flex items-center justify-between font-medium">
              <span className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300">
                <Clock className="w-3.5 h-3.5 text-neutral-500" />
                Duração Registrada:
              </span>
              <span className="font-mono text-sm font-bold text-neutral-900 dark:text-neutral-100">
                {formatTimeHHMMSS(elapsedMs)}
              </span>
            </div>
            <div className="flex items-center justify-between font-medium">
              <span className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                Valor Faturável:
              </span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                {formatCurrency(currentBillable)}
              </span>
            </div>
            {activeClient && (
              <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 pt-1 border-t border-neutral-200/60 dark:border-neutral-750/60">
                <span className="flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-neutral-400" />
                  Cliente Vinculado:
                </span>
                <span className="font-medium text-neutral-800 dark:text-neutral-200 truncate max-w-[200px]">
                  {activeClient.name}
                </span>
              </div>
            )}
            {activeTasks.length > 0 && (
              <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-neutral-400" />
                  Tarefas Registradas:
                </span>
                <span>
                  {activeTasks.length} {activeTasks.length === 1 ? 'tarefa' : 'tarefas'}
                </span>
              </div>
            )}
          </div>

          {/* Title input with confirmation */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Título da Sessão
              </label>
              <button
                type="button"
                onClick={() => handleSuggestTitleFromTasks('modal')}
                disabled={isSuggestingModalTitle}
                className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium cursor-pointer transition-colors"
                title="Sugerir título com base nas tarefas usando o modelo de IA"
              >
                {isSuggestingModalTitle ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                <span>Sugerir com base em tarefas</span>
              </button>
            </div>
            <Input
              value={confirmStopTitle}
              onChange={(e) => setConfirmStopTitle(e.target.value)}
              placeholder="Ex: Desenvolvimento Frontend, Reunião de Alinhamento..."
              className="text-sm font-medium"
              autoFocus
            />
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Deseja manter ou alterar o título antes de salvar? Você pode editá-lo agora para facilitar a identificação nos relatórios.
            </p>
          </div>

          {/* Session Notes input with confirmation */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-neutral-500" />
              <span>Observações da Sessão (Cronômetro)</span>
            </label>
            <textarea
              value={confirmStopNotes}
              onChange={(e) => setConfirmStopNotes(e.target.value)}
              placeholder="Anotações gerais, contexto do trabalho, pendências ou resumo da sessão..."
              rows={3}
              className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-xs font-medium text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100"
            />
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Observações vinculadas a esta sessão de cronômetro, que também serão exibidas no relatório compartilhado.
            </p>
          </div>

          {/* Modal Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsStopModalOpen(false)}
              disabled={isFinalizing}
              className="cursor-pointer"
            >
              Cancelar / Continuar Timer
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={isFinalizing}
              className="gap-1.5 font-semibold cursor-pointer shadow-sm"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>{isFinalizing ? 'Finalizando...' : 'Confirmar e Finalizar'}</span>
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Git Commit & Task Extraction Modal (Options 1A & 1B) */}
      <GitCommitModal
        open={gitModalOpen}
        onOpenChange={setGitModalOpen}
        tenant={tenant || null}
        activeSession={activeSession}
        sessions={sessions}
        clients={clients}
        onTasksCreated={async () => {
          if (onRefreshData) {
            await onRefreshData();
          }
        }}
        onNavigateToSettings={onNavigateToSettings}
      />

      {/* Notes Slide-Over Drawer */}
      {isNotesDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-150">
          <div className="w-full sm:max-w-3xl lg:max-w-4xl xl:max-w-5xl bg-white dark:bg-neutral-900 shadow-2xl border-l border-neutral-200 dark:border-neutral-800 flex flex-col h-full animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 shrink-0">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">Gaveta de Anotações &amp; TODO</h3>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsNotesDrawerOpen(false)}
                className="h-7 w-7 p-0 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex-1 p-3 bg-neutral-50/40 dark:bg-neutral-950/40 min-h-0 overflow-hidden flex flex-col">
              <NotesView
                currentUserId={currentUserId || ''}
                addToast={effectiveAddToast}
                isDrawer={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
