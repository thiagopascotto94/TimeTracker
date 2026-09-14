import React, { useState } from 'react';
import {
  Clock,
  DollarSign,
  Link2,
  Trash2,
  Share2,
  Play,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Briefcase,
  AlertTriangle,
  FileText,
  Lock,
  Edit3,
  Plus,
  Save,
  X,
  Info,
  Check,
  Calendar,
} from 'lucide-react';
import { TimeSession, Client } from '../types';
import {
  formatCurrency,
  formatDateTime,
  formatDurationHuman,
} from '../utils/format';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { useToast } from './ui/toast';
import { Dialog } from './ui/dialog';
import { ClientFilterAutocomplete } from './ClientFilterAutocomplete';

interface EditTaskItem {
  id?: string;
  description: string;
  notes?: string | null;
  is_deleted?: boolean;
}

interface HistoryViewProps {
  sessions: TimeSession[];
  hourlyRate: number;
  clients: Client[];
  onResumeSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => Promise<void>;
  onShareSession: (sessionId: string) => void;
  onUpdateSession?: (
    sessionId: string,
    data: {
      title?: string;
      hourly_rate?: number | null;
      notes?: string | null;
      client_id?: string | null;
      tasks?: EditTaskItem[];
    }
  ) => Promise<void>;
  loading: boolean;
}

export function HistoryView({
  sessions,
  hourlyRate,
  clients,
  onResumeSession,
  onDeleteSession,
  onShareSession,
  onUpdateSession,
  loading,
}: HistoryViewProps) {
  const { addToast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);
  const [expandedSessionNotes, setExpandedSessionNotes] = useState<Record<string, boolean>>({});
  const [expandedTaskNotes, setExpandedTaskNotes] = useState<Record<string, boolean>>({});

  // Edit Modal State
  const [editingSession, setEditingSession] = useState<TimeSession | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editHourlyRate, setEditHourlyRate] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editClientId, setEditClientId] = useState<string>('');
  const [editTasks, setEditTasks] = useState<EditTaskItem[]>([]);
  const [newTaskDesc, setNewTaskDesc] = useState<string>('');
  const [newTaskNotes, setNewTaskNotes] = useState<string>('');
  const [showNewTaskForm, setShowNewTaskForm] = useState<boolean>(false);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  const toggleSessionNote = (sessionId: string) => {
    setExpandedSessionNotes((prev) => ({ ...prev, [sessionId]: !prev[sessionId] }));
  };

  const toggleTaskNote = (taskId: string) => {
    setExpandedTaskNotes((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Open edit modal for a session
  const openEditModal = (s: TimeSession) => {
    if (s.is_locked) {
      addToast({
        title: 'Sessão Bloqueada',
        description:
          s.locked_reason ||
          'Esta sessão já foi aprovada em relatório e não pode mais ser editada.',
        variant: 'destructive',
      });
      return;
    }

    setEditingSession(s);
    setEditTitle(s.title || 'Sessão de Trabalho');
    setEditHourlyRate(
      s.hourly_rate !== null && s.hourly_rate !== undefined ? String(s.hourly_rate) : ''
    );
    setEditNotes(s.notes || '');
    setEditClientId(s.client_id || s.Client?.id || s.client?.id || '');

    const existingTasks = s.Tasks || s.tasks || [];
    setEditTasks(
      existingTasks.map((t) => ({
        id: t.id,
        description: t.description,
        notes: t.notes || '',
        is_deleted: false,
      }))
    );
    setNewTaskDesc('');
    setNewTaskNotes('');
    setShowNewTaskForm(false);
  };

  const handleAddNewTaskToEdit = () => {
    if (!newTaskDesc.trim()) {
      addToast({
        title: 'Descrição obrigatória',
        description: 'Digite o título da tarefa antes de adicionar.',
        variant: 'destructive',
      });
      return;
    }

    setEditTasks((prev) => [
      ...prev,
      {
        description: newTaskDesc.trim(),
        notes: newTaskNotes.trim() || null,
        is_deleted: false,
      },
    ]);
    setNewTaskDesc('');
    setNewTaskNotes('');
    setShowNewTaskForm(false);
  };

  const handleRemoveTaskFromEdit = (index: number) => {
    setEditTasks((prev) => {
      const target = prev[index];
      if (target.id) {
        // Mark for deletion if it exists on database
        return prev.map((t, idx) => (idx === index ? { ...t, is_deleted: true } : t));
      }
      // If newly added, simply remove from list
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const handleRestoreTaskInEdit = (index: number) => {
    setEditTasks((prev) =>
      prev.map((t, idx) => (idx === index ? { ...t, is_deleted: false } : t))
    );
  };

  const handleSaveEdit = async () => {
    if (!editingSession || !onUpdateSession) return;

    if (!editTitle.trim()) {
      addToast({
        title: 'Título obrigatório',
        description: 'Informe um título válido para a sessão.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSavingEdit(true);

      const parsedRate = editHourlyRate.trim() ? parseFloat(editHourlyRate.replace(',', '.')) : null;

      await onUpdateSession(editingSession.id, {
        title: editTitle.trim(),
        hourly_rate: isNaN(parsedRate as number) ? null : parsedRate,
        notes: editNotes.trim() || null,
        client_id: editClientId || null,
        tasks: editTasks,
      });

      setEditingSession(null);
    } catch (err) {
      // Error handled in parent handler
    } finally {
      setIsSavingEdit(false);
    }
  };

  const filteredSessions = sessions.filter((s) => {
    if (clientFilter === 'all') return true;
    const cId = s.client_id || s.Client?.id || s.client?.id;
    return cId === clientFilter;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
          Histórico de Sessões
        </h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Visualize todas as sessões registradas, edite títulos, valores da hora, tarefas e observações (controlado por bloqueio de aprovação).
        </p>
      </div>

      <Card className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs">
        <CardHeader className="pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              Registro Cronológico
            </CardTitle>
            <div className="flex items-center gap-2">
              <ClientFilterAutocomplete
                clients={clients}
                selectedClientId={clientFilter}
                onSelectClient={setClientFilter}
                allLabel="Todos os Clientes"
                allValue="all"
              />
              <Badge variant="outline" className="text-xs">
                {filteredSessions.length} de {sessions.length} sessões
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredSessions.length === 0 ? (
            <div className="py-12 text-center text-sm text-neutral-400 dark:text-neutral-500">
              Nenhuma sessão encontrada para o filtro selecionado.
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {filteredSessions.map((s) => {
                const start = new Date(s.start_time).getTime();
                const end = s.end_time ? new Date(s.end_time).getTime() : Date.now();
                const durationMs = Math.max(0, end - start);
                const decimalHours = durationMs / 3600000;
                const clientObj = s.Client || s.client;
                // Prioridade: taxa específica da sessão -> taxa do cliente -> taxa padrão
                const sessionRate = s.hourly_rate ?? (clientObj?.hourly_rate ?? hourlyRate);
                const billable = decimalHours * sessionRate;
                const tasks = s.Tasks || s.tasks || [];
                const isExpanded = expandedId === s.id;
                const isLocked = Boolean(s.is_locked);

                return (
                  <div
                    key={s.id}
                    className={`p-4 sm:p-5 transition-colors ${
                      isLocked
                        ? 'bg-neutral-50/30 dark:bg-neutral-900/40 hover:bg-neutral-50/60 dark:hover:bg-neutral-850/40'
                        : 'hover:bg-neutral-50/50 dark:hover:bg-neutral-850/50'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Left: Info */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
                            {s.title}
                          </h4>

                          {/* Approval / Lock Status */}
                          {isLocked ? (
                            <Badge
                              variant="outline"
                              className="text-2xs gap-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 font-medium"
                              title={s.locked_reason || 'Sessão aprovada no relatório. Bloqueada permanentemente no banco de dados.'}
                            >
                              <Lock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span>Aprovada no Relatório (Bloqueada)</span>
                            </Badge>
                          ) : null}

                          {!s.end_time && (
                            <Badge variant="amber" className="text-2xs uppercase">
                              Em Andamento
                            </Badge>
                          )}
                          {s.target_minutes && (
                            <Badge variant="outline" className="text-2xs">
                              Meta: {s.target_minutes}m
                            </Badge>
                          )}
                          {clientObj && (
                            <Badge
                              variant="secondary"
                              className="text-2xs gap-1 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800"
                            >
                              <Briefcase className="w-3 h-3" />
                              {clientObj.name}
                            </Badge>
                          )}
                          {s.hourly_rate !== null && s.hourly_rate !== undefined && (
                            <Badge
                              variant="outline"
                              className="text-2xs gap-1 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/40 font-mono"
                              title="Taxa por hora personalizada desta sessão"
                            >
                              R$ {Number(s.hourly_rate).toFixed(2)}/h
                            </Badge>
                          )}
                          {s.notes && (
                            <button
                              type="button"
                              onClick={() => toggleSessionNote(s.id)}
                              className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors cursor-pointer"
                              title="Clique para ver a observação da sessão"
                            >
                              <FileText className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400" />
                              <span>Observação</span>
                            </button>
                          )}
                        </div>

                        {/* Session Note Box */}
                        {s.notes && expandedSessionNotes[s.id] && (
                          <div className="mt-1.5 p-2 rounded-md bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-800/50 text-xs text-blue-950 dark:text-blue-200 whitespace-pre-wrap leading-relaxed">
                            <span className="font-semibold text-2xs text-blue-800 dark:text-blue-300 block mb-0.5 uppercase tracking-wide">
                              Observação da sessão:
                            </span>
                            {s.notes}
                          </div>
                        )}

                        <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400 flex-wrap">
                          <span>{formatDateTime(s.start_time)}</span>
                          {s.end_time && (
                            <>
                              <span>•</span>
                              <span>Até {formatDateTime(s.end_time)}</span>
                            </>
                          )}
                          <span>•</span>
                          <span className="font-medium text-neutral-700 dark:text-neutral-300">
                            {formatDurationHuman(durationMs)}
                          </span>
                          <span>•</span>
                          <span>{tasks.length} {tasks.length === 1 ? 'tarefa' : 'tarefas'}</span>
                        </div>

                        {/* Lock reason info notice */}
                        {isLocked && s.locked_reason && (
                          <p className="text-2xs text-emerald-700/80 dark:text-emerald-400/80 italic flex items-center gap-1 mt-0.5">
                            <Info className="w-2.5 h-2.5 shrink-0" />
                            {s.locked_reason}
                          </p>
                        )}
                      </div>

                      {/* Right: Metrics & Actions */}
                      <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                        <div className="text-right">
                          <div className="text-xs text-neutral-500 dark:text-neutral-400">
                            {decimalHours.toFixed(2)}h @ R$ {sessionRate.toFixed(2)}/h
                          </div>
                          <div className="text-sm font-bold text-neutral-900 dark:text-neutral-100 font-mono">
                            {formatCurrency(billable)}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {/* Resume/Continue button (RF06) */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onResumeSession(s.id)}
                            className="h-8 px-2.5 text-xs gap-1 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                            title="Continuar este trabalho em uma nova sessão"
                          >
                            <Play className="w-3 h-3 fill-current text-indigo-600 dark:text-indigo-400" />
                            <span className="hidden sm:inline">Continuar</span>
                          </Button>

                          {/* Edit Session Button */}
                          {onUpdateSession && (
                            isLocked ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled
                                className="h-8 px-2 text-xs gap-1 text-neutral-400 dark:text-neutral-600 cursor-not-allowed opacity-60"
                                title="Esta sessão foi aprovada no relatório e está bloqueada no banco de dados. Nenhuma alteração é permitida."
                              >
                                <Lock className="w-3.5 h-3.5 text-neutral-400" />
                                <span className="hidden md:inline">Bloqueada</span>
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditModal(s)}
                                className="h-8 px-2.5 text-xs gap-1 border-neutral-200 dark:border-neutral-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-neutral-700 dark:text-neutral-300 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                                title="Editar título, valor da hora, tarefas e observações"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                <span className="hidden md:inline">Editar</span>
                              </Button>
                            )
                          )}

                          {/* Share single session */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onShareSession(s.id)}
                            className="h-8 w-8 p-0 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 cursor-pointer"
                            title="Compartilhar esta sessão"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </Button>

                          {/* Expand tasks */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpand(s.id)}
                            className="h-8 w-8 p-0 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 cursor-pointer"
                            title="Ver anotações e tarefas"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </Button>

                          {/* Delete session */}
                          {isLocked ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled
                              className="h-8 w-8 p-0 text-neutral-300 dark:text-neutral-700 cursor-not-allowed opacity-50"
                              title="Sessões aprovadas não podem ser excluídas"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteSessionId(s.id)}
                              className="h-8 w-8 p-0 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                              title="Excluir sessão"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expandable tasks list */}
                    {isExpanded && (
                      <div className="mt-3 pl-4 border-l-2 border-neutral-200 dark:border-neutral-750 py-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-2xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block">
                            Tarefas registradas ({tasks.length}):
                          </span>
                          {!isLocked && onUpdateSession && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(s)}
                              className="h-6 px-2 text-2xs gap-1 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" />
                              Gerenciar Tarefas
                            </Button>
                          )}
                        </div>

                        {tasks.length === 0 ? (
                          <p className="text-xs text-neutral-400 italic">
                            Nenhuma tarefa cadastrada nesta sessão.
                          </p>
                        ) : (
                          <ul className="space-y-1.5">
                            {tasks.map((t) => (
                              <li
                                key={t.id}
                                className="text-xs text-neutral-700 dark:text-neutral-300"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-start gap-1.5 flex-1 min-w-0">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                                    <span className="leading-relaxed break-words">{t.description}</span>
                                  </div>
                                  {t.notes && (
                                    <button
                                      type="button"
                                      onClick={() => toggleTaskNote(t.id)}
                                      className="shrink-0 inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors cursor-pointer"
                                      title="Clique para ver a observação desta tarefa"
                                    >
                                      <FileText className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                                      <span>Observação</span>
                                    </button>
                                  )}
                                </div>
                                {t.notes && expandedTaskNotes[t.id] && (
                                  <div className="mt-1.5 ml-5 p-2 rounded-md bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-800/50 text-xs text-amber-950 dark:text-amber-200 whitespace-pre-wrap leading-relaxed">
                                    <span className="font-semibold text-2xs text-amber-800 dark:text-amber-300 block mb-0.5 uppercase tracking-wide">
                                      Observação da tarefa:
                                    </span>
                                    {t.notes}
                                  </div>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}

                        {isLocked && (
                          <div className="flex items-center gap-1.5 text-2xs text-neutral-400 dark:text-neutral-500 italic pt-1">
                            <Lock className="w-3 h-3 text-neutral-400" />
                            <span>Sessão bloqueada: título, valor da hora, tarefas e observações tornaram-se imutáveis após aprovação do relatório.</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Complete Session Edit Modal */}
      <Dialog
        open={Boolean(editingSession)}
        onOpenChange={(open) => !open && setEditingSession(null)}
        title="Editar Sessão de Trabalho"
        description="Edite os dados desta sessão. Ao aprovar um relatório público vinculado, a sessão será permanentemente bloqueada para modificações no banco de dados."
      >
        {editingSession && (
          <div className="space-y-4 pt-2 max-h-[75vh] overflow-y-auto pr-1">
            {/* Title */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Título da Sessão <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Ex: Refatoração da API e Correção de Bugs"
                className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            {/* Hourly Rate & Client */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                  <span>Valor da Hora (R$/h)</span>
                  <span className="text-2xs font-normal text-neutral-400">Personalizado</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editHourlyRate}
                    onChange={(e) => setEditHourlyRate(e.target.value)}
                    placeholder={`${
                      editingSession.Client?.hourly_rate ?? hourlyRate
                    } (padrão)`}
                    className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                  />
                </div>
                <p className="text-2xs text-neutral-400">
                  Deixe vazio para usar a taxa do cliente (R$ {editingSession.Client?.hourly_rate ?? hourlyRate}/h).
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Cliente Vinculado
                </label>
                <select
                  value={editClientId}
                  onChange={(e) => setEditClientId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="">Nenhum cliente (Geral)</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.hourly_rate ? `(R$ ${c.hourly_rate}/h)` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Session Notes */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                <span>Observações Gerais da Sessão</span>
                <span className="text-2xs font-normal text-neutral-400">Opcional</span>
              </label>
              <textarea
                rows={3}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Insira detalhes gerais, contexto, links ou anotações desta sessão de trabalho..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-y"
              />
            </div>

            {/* Tasks Section */}
            <div className="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                  Tarefas e Anotações da Sessão ({editTasks.filter((t) => !t.is_deleted).length})
                </label>
                {!showNewTaskForm && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNewTaskForm(true)}
                    className="h-7 px-2 text-xs gap-1 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Tarefa</span>
                  </Button>
                )}
              </div>

              {/* Add New Task Form inside Modal */}
              {showNewTaskForm && (
                <div className="p-3 rounded-lg border border-indigo-100 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-300">
                      Nova Tarefa
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowNewTaskForm(false)}
                      className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={newTaskDesc}
                    onChange={(e) => setNewTaskDesc(e.target.value)}
                    placeholder="Descrição da tarefa..."
                    className="w-full px-3 py-1.5 text-xs rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <textarea
                    rows={2}
                    value={newTaskNotes}
                    onChange={(e) => setNewTaskNotes(e.target.value)}
                    placeholder="Observações da tarefa (opcional)..."
                    className="w-full px-3 py-1.5 text-xs rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowNewTaskForm(false)}
                      className="h-7 px-2 text-xs"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddNewTaskToEdit}
                      className="h-7 px-3 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1 cursor-pointer"
                    >
                      <Check className="w-3 h-3" />
                      Salvar
                    </Button>
                  </div>
                </div>
              )}

              {/* Tasks List */}
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {editTasks.filter((t) => !t.is_deleted).length === 0 && !showNewTaskForm ? (
                  <p className="text-xs text-neutral-400 italic py-2">
                    Nenhuma tarefa associada a esta sessão. Clique em "Adicionar Tarefa" acima.
                  </p>
                ) : (
                  editTasks.map((t, idx) => {
                    if (t.is_deleted) {
                      return (
                        <div
                          key={t.id || idx}
                          className="flex items-center justify-between p-2 rounded-lg bg-red-50/50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-900/40 text-xs text-neutral-400 line-through"
                        >
                          <span className="truncate flex-1">{t.description}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRestoreTaskInEdit(idx)}
                            className="h-6 px-2 text-2xs text-red-600 dark:text-red-400 no-underline cursor-pointer"
                          >
                            Restaurar
                          </Button>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={t.id || idx}
                        className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-850/50 space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <input
                            type="text"
                            value={t.description}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditTasks((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, description: val } : item))
                              );
                            }}
                            placeholder="Descrição da tarefa"
                            className="flex-1 px-2.5 py-1 text-xs rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveTaskFromEdit(idx)}
                            className="h-7 w-7 p-0 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 shrink-0 cursor-pointer"
                            title="Remover tarefa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>

                        {/* Task Notes */}
                        <div className="space-y-0.5">
                          <textarea
                            rows={1}
                            value={t.notes || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditTasks((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, notes: val } : item))
                              );
                            }}
                            placeholder="Observações da tarefa (opcional)..."
                            className="w-full px-2.5 py-1 text-xs rounded border border-neutral-200 dark:border-neutral-700 bg-white/70 dark:bg-neutral-800/70 text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y"
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingSession(null)}
                disabled={isSavingEdit}
                className="cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingEdit ? 'Salvando...' : 'Salvar Alterações'}</span>
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Delete Session Confirmation Modal */}
      <Dialog
        open={Boolean(deleteSessionId)}
        onOpenChange={(open) => !open && setDeleteSessionId(null)}
        title="Excluir Sessão"
        description="Tem certeza que deseja excluir esta sessão de trabalho do histórico?"
      >
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-300 text-xs">
            <AlertTriangle className="w-5 h-5 shrink-0 text-red-600 dark:text-red-400" />
            <span>Esta ação é permanente e removerá todas as tarefas e registros associados a esta sessão.</span>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setDeleteSessionId(null)}
              className="cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (deleteSessionId) {
                  await onDeleteSession(deleteSessionId);
                  setDeleteSessionId(null);
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white cursor-pointer"
            >
              Sim, Excluir
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
