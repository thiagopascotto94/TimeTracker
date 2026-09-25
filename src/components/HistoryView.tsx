import React, { useState, useEffect } from 'react';
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
  ExternalLink,
  Copy,
  Search,
  History,
} from 'lucide-react';
import dayjs from 'dayjs';
import { TimeSession, Client } from '../types';
import {
  formatCurrency,
  formatDateTime,
  formatDurationHuman,
} from '../utils/format';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useToast } from './ui/toast';
import { Dialog } from './ui/dialog';
import { ClientFilterAutocomplete } from './ClientFilterAutocomplete';
import { EmptyState } from './ui/empty-state';
import { apiFetch } from '../utils/api';
import { TaskLinkCard } from './TaskLinkCard';

interface EditTaskItem {
  id?: string;
  description: string;
  notes?: string | null;
  link?: string | null;
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
  onEditSession: (sessionId: string) => void;
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
  onEditSession,
  loading,
}: HistoryViewProps) {
  const { addToast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);
  const [expandedSessionNotes, setExpandedSessionNotes] = useState<Record<string, boolean>>({});
  const [expandedTaskNotes, setExpandedTaskNotes] = useState<Record<string, boolean>>({});

  // Share Session Modal State
  const [sharingSession, setSharingSession] = useState<TimeSession | null>(null);
  const [shareTitle, setShareTitle] = useState<string>('');
  const [includeCost, setIncludeCost] = useState<boolean>(true);
  const [allowApproval, setAllowApproval] = useState<boolean>(true);
  const [shareLoading, setShareLoading] = useState<boolean>(false);
  const [generatedShareToken, setGeneratedShareToken] = useState<string | null>(null);
  const [generatedApprovalCode, setGeneratedApprovalCode] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [approvalCopied, setApprovalCopied] = useState<boolean>(false);

  const openShareModal = (s: TimeSession) => {
    setSharingSession(s);
    setShareTitle(s.title ? `Relatório: ${s.title}` : 'Relatório da Sessão de Trabalho');
    setIncludeCost(true);
    setAllowApproval(true);
    setGeneratedShareToken(null);
    setGeneratedApprovalCode(null);
    setCopied(false);
    setApprovalCopied(false);
  };

  const handleEditClick = (s: TimeSession) => {
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
    onEditSession(s.id);
  };

  const handleCreateShareToken = async () => {
    if (!sharingSession) return;
    try {
      setShareLoading(true);
      const res = await apiFetch('/api/reports/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sharingSession.id,
          title: shareTitle,
          include_cost: includeCost,
          allow_approval: allowApproval,
        }),
      });
      if (!res.ok) throw new Error('Erro ao compartilhar sessão');
      const data = await res.json();
      setGeneratedShareToken(data.token);
      setGeneratedApprovalCode(data.approval_code);
      addToast({
        title: 'Link Público Gerado!',
        description: 'Link gerado com sucesso com as preferências de segurança selecionadas.',
        variant: 'success',
      });
    } catch (err: any) {
      addToast({
        title: 'Erro ao gerar link',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setShareLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!generatedShareToken) return;
    const url = `${window.location.origin}/shared/${generatedShareToken}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addToast({
      title: 'Link copiado!',
      description: 'Link público copiado para a área de transferência.',
      variant: 'default',
    });
  };

  const copyApprovalCode = () => {
    if (!generatedApprovalCode) return;
    navigator.clipboard.writeText(generatedApprovalCode);
    setApprovalCopied(true);
    setTimeout(() => setApprovalCopied(false), 2000);
    addToast({
      title: 'Código copiado!',
      description: 'Código de aprovação copiado com sucesso.',
      variant: 'default',
    });
  };

  const toggleSessionNote = (sessionId: string) => {
    setExpandedSessionNotes((prev) => ({ ...prev, [sessionId]: !prev[sessionId] }));
  };

  const toggleTaskNote = (taskId: string) => {
    setExpandedTaskNotes((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const [fetchedSessions, setFetchedSessions] = useState<TimeSession[]>(sessions);
  const [isFiltering, setIsFiltering] = useState<boolean>(false);

  useEffect(() => {
    if (!searchQuery && clientFilter === 'all' && !startDate && !endDate) {
      setFetchedSessions(sessions);
    }
  }, [sessions]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        setIsFiltering(true);
        const params = new URLSearchParams();
        if (searchQuery.trim()) params.append('search', searchQuery.trim());
        if (clientFilter && clientFilter !== 'all') params.append('clientId', clientFilter);
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);

        const res = await apiFetch(`/api/sessions?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setFetchedSessions(data.sessions || []);
        }
      } catch (err) {
        console.error('Error filtering sessions via API:', err);
      } finally {
        setIsFiltering(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery, clientFilter, startDate, endDate]);

  const filteredSessions = fetchedSessions;

  return (
    <div className="space-y-4 sm:space-y-6 px-3 sm:px-6 py-4 pb-24 max-w-7xl mx-auto animate-in fade-in duration-200">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
          Histórico de Sessões
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
          Visualize todas as sessões registradas, edite títulos, valores da hora, tarefas e observações (controlado por bloqueio de aprovação).
        </p>
      </div>

      <Card className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs">
        <CardHeader className="pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm sm:text-base font-bold text-neutral-900 dark:text-neutral-100">
                Registro Cronológico
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                {filteredSessions.length} de {sessions.length} sessões
              </Badge>
            </div>
            
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                {/* Search Bar */}
                <div className="sm:col-span-7 relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                  <Input
                    type="text"
                    placeholder="Pesquisar por título, cliente ou observação..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-8 text-xs h-9 bg-neutral-50/50 dark:bg-neutral-800/50"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Client Filter */}
                <div className="sm:col-span-5">
                  <ClientFilterAutocomplete
                    clients={clients}
                    selectedClientId={clientFilter}
                    onSelectClient={setClientFilter}
                    allLabel="Todos os Clientes"
                    allValue="all"
                  />
                </div>
              </div>

              {/* Date Range Picker & Reset */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50/70 dark:bg-neutral-850/50 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-2xs font-semibold text-neutral-500 dark:text-neutral-400 shrink-0">De:</span>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="text-2xs h-8 px-2 bg-white dark:bg-neutral-800 flex-1"
                    />
                  </div>
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-2xs font-semibold text-neutral-500 dark:text-neutral-400 shrink-0">Até:</span>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="text-2xs h-8 px-2 bg-white dark:bg-neutral-800 flex-1"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                  {isFiltering && (
                    <span className="text-2xs text-indigo-600 dark:text-indigo-400 animate-pulse font-medium">
                      Buscando...
                    </span>
                  )}
                  {(searchQuery || clientFilter !== 'all' || startDate || endDate) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchQuery('');
                        setClientFilter('all');
                        setStartDate('');
                        setEndDate('');
                      }}
                      className="h-8 px-3 text-xs text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5 mr-1" />
                      <span>Limpar Filtros</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredSessions.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Clock}
                title="Nenhuma sessão encontrada"
                description={
                  sessions.length === 0
                    ? "Você ainda não registrou nenhuma sessão de tempo. Inicie o timer para começar a registrar seu progresso."
                    : "Nenhuma sessão corresponde aos filtros de pesquisa ou cliente selecionados."
                }
              />
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
                          {s.is_retroactive ? (
                            <Badge
                              variant="outline"
                              className="text-2xs gap-1 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800 bg-purple-50/60 dark:bg-purple-950/40"
                              title={s.retroactive_reason ? `Início Retroativo: "${s.retroactive_reason}"` : 'Início Retroativo'}
                            >
                              <History className="w-2.5 h-2.5 text-purple-600 dark:text-purple-400" />
                              <span>Retroativo ({s.retroactive_minutes || 0}m)</span>
                            </Badge>
                          ) : null}
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

                        {/* Retroactive Info */}
                        {s.is_retroactive && s.retroactive_reason && (
                          <div className="mt-1.5 p-2 rounded-md bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/70 dark:border-purple-800/50 text-xs text-purple-950 dark:text-purple-200 flex items-start gap-1.5">
                            <History className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold text-2xs text-purple-800 dark:text-purple-300 block uppercase tracking-wide">
                                Início Retroativo ({s.retroactive_minutes || 0}m atrás):
                              </span>
                              <span>"{s.retroactive_reason}"</span>
                            </div>
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
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 self-stretch sm:self-center justify-between sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-100 dark:border-neutral-800">
                        <div className="text-left sm:text-right">
                          <div className="text-2xs sm:text-xs text-neutral-500 dark:text-neutral-400">
                            {decimalHours.toFixed(2)}h @ R$ {sessionRate.toFixed(2)}/h
                          </div>
                          <div className="text-sm sm:text-base font-bold text-neutral-900 dark:text-neutral-100 font-mono">
                            {formatCurrency(billable)}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {/* Resume/Continue button (RF06) */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onResumeSession(s.id)}
                            className="h-9 sm:h-8 px-3 sm:px-2.5 text-xs gap-1 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                            title="Continuar este trabalho em uma nova sessão"
                          >
                            <Play className="w-3.5 h-3.5 sm:w-3 sm:h-3 fill-current text-indigo-600 dark:text-indigo-400 shrink-0" />
                            <span>Continuar</span>
                          </Button>

                          {/* Edit Session Button */}
                          {onUpdateSession && (
                            isLocked ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled
                                className="h-9 sm:h-8 px-2.5 text-xs gap-1 text-neutral-400 dark:text-neutral-600 cursor-not-allowed opacity-60"
                                title="Esta sessão foi aprovada no relatório e está bloqueada no banco de dados. Nenhuma alteração é permitida."
                              >
                                <Lock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                                <span className="hidden md:inline">Bloqueada</span>
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditClick(s)}
                                className="h-9 sm:h-8 px-2.5 text-xs gap-1 border-neutral-200 dark:border-neutral-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-neutral-700 dark:text-neutral-300 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                                title="Editar título, valor da hora, tarefas e observações"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                <span className="hidden md:inline">Editar</span>
                              </Button>
                            )
                          )}

                          {/* Share single session */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openShareModal(s)}
                            className="h-9 w-9 sm:h-8 sm:w-8 p-0 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 cursor-pointer"
                            title="Compartilhar esta sessão com opções de preços e aprovação"
                          >
                            <Share2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                          </Button>

                          {/* Expand tasks */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpand(s.id)}
                            className="h-9 w-9 sm:h-8 sm:w-8 p-0 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 cursor-pointer"
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
                              className="h-9 w-9 sm:h-8 sm:w-8 p-0 text-neutral-300 dark:text-neutral-700 cursor-not-allowed opacity-50"
                              title="Sessões aprovadas não podem ser excluídas"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteSessionId(s.id)}
                              className="h-9 w-9 sm:h-8 sm:w-8 p-0 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
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
                              onClick={() => handleEditClick(s)}
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
                                className="text-xs text-neutral-700 dark:text-neutral-300 space-y-1.5"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-start gap-1.5 flex-1 min-w-0">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                                    <span className="leading-relaxed break-words">{t.description}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {t.link && (
                                      <a
                                        href={t.link}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
                                        title={`Abrir commit no repositório: ${t.link}`}
                                      >
                                        <ExternalLink className="w-2.5 h-2.5 text-indigo-600 dark:text-indigo-400" />
                                        <span>Commit</span>
                                      </a>
                                    )}
                                    {t.notes && (
                                      <button
                                        type="button"
                                        onClick={() => toggleTaskNote(t.id)}
                                        className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors cursor-pointer"
                                        title="Clique para ver a observação desta tarefa"
                                      >
                                        <FileText className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                                        <span>Observação</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div className="ml-5">
                                  <TaskLinkCard notes={t.notes} link={t.link} />
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

      {/* Share Session Modal */}
      <Dialog
        open={Boolean(sharingSession)}
        onOpenChange={(open) => !open && setSharingSession(null)}
        title="Compartilhar Sessão de Trabalho"
        description="Gere um link seguro com opções de exibição de preços e aprovação para seu cliente."
      >
        <div className="space-y-4 pt-2">
          {!generatedShareToken ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Título do Relatório
                </label>
                <Input
                  value={shareTitle}
                  onChange={(e) => setShareTitle(e.target.value)}
                  placeholder="Ex: Relatório de Horas - Tarefas Concluídas"
                  className="text-sm"
                  style={{ color: '#000000' }}
                />
              </div>

              {sharingSession && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Detalhes da Sessão
                  </label>
                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-750 bg-neutral-50 dark:bg-neutral-850 p-3 text-xs text-neutral-600 dark:text-neutral-300 space-y-1.5">
                    <p>
                      <strong>Cliente:</strong>{' '}
                      {sharingSession.Client?.name ||
                        sharingSession.client?.name ||
                        clients.find((c) => c.id === sharingSession.client_id)?.name ||
                        'Sem cliente vinculado'}
                    </p>
                    <p>
                      <strong>Período:</strong>{' '}
                      {formatDateTime(sharingSession.start_time)}
                    </p>
                    <p>
                      <strong>Tarefas:</strong>{' '}
                      {(sharingSession.Tasks || sharingSession.tasks || []).length} tarefa(s) registrada(s)
                    </p>
                    {(() => {
                      const start = new Date(sharingSession.start_time).getTime();
                      const end = sharingSession.end_time ? new Date(sharingSession.end_time).getTime() : Date.now();
                      const durationMs = Math.max(0, end - start);
                      const rate = sharingSession.hourly_rate ?? (sharingSession.Client?.hourly_rate ?? hourlyRate);
                      const billable = (durationMs / 3600000) * rate;
                      return (
                        <p className="text-emerald-700 dark:text-emerald-400 font-medium">
                          <strong>Total a Faturar:</strong>{' '}
                          {includeCost ? formatCurrency(billable) : 'Oculto (preços desativados no link)'}
                        </p>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Opções de Compartilhamento Seguro */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Opções de Segurança &amp; Exibição
                </label>
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-750 bg-neutral-50/70 dark:bg-neutral-850/50 p-3 space-y-3">
                  {/* Opção: Exibir preços */}
                  <label className="flex items-start gap-3 cursor-pointer group select-none">
                    <input
                      type="checkbox"
                      id="hist-share-opt-include-cost"
                      checked={includeCost}
                      onChange={(e) => setIncludeCost(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-neutral-300 dark:border-neutral-600 text-neutral-900 dark:text-neutral-100 focus:ring-neutral-900 cursor-pointer"
                    />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Exibir preços</span>
                      </div>
                      <p className="text-2xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                        Exibe taxas por hora e valor total faturável. Quando desmarcado, omite com segurança todos os dados financeiros no link.
                      </p>
                    </div>
                  </label>

                  <div className="border-t border-neutral-200 dark:border-neutral-750" />

                  {/* Opção: Aprovação */}
                  <label className="flex items-start gap-3 cursor-pointer group select-none">
                    <input
                      type="checkbox"
                      id="hist-share-opt-allow-approval"
                      checked={allowApproval}
                      onChange={(e) => setAllowApproval(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-neutral-300 dark:border-neutral-600 text-neutral-900 dark:text-neutral-100 focus:ring-neutral-900 cursor-pointer"
                    />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>Aprovação</span>
                      </div>
                      <p className="text-2xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                        Permite que o cliente aprove formalmente o relatório na página pública com assinatura digital e código de aprovação.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSharingSession(null)}
                  className="text-xs cursor-pointer"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreateShareToken}
                  disabled={shareLoading || !shareTitle.trim()}
                  className="text-xs gap-1.5 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{shareLoading ? 'Gerando...' : 'Gerar Link Seguro'}</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/60 p-3 text-xs text-emerald-900 dark:text-emerald-200 space-y-2">
                <div className="font-semibold flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Link criado com sucesso!
                </div>
                <p>
                  {includeCost
                    ? 'O cliente poderá visualizar as atividades, horas e precificação desta sessão.'
                    : 'Modo seguro ativo: Valores monetários foram omitidos da visualização pública.'}
                </p>
                <div className="flex flex-wrap gap-2 pt-1 text-2xs font-medium">
                  <span className={`px-2 py-0.5 rounded-full border ${includeCost ? 'bg-emerald-100 dark:bg-emerald-900/60 border-emerald-300 text-emerald-800 dark:text-emerald-200' : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-300 text-neutral-700 dark:text-neutral-300'}`}>
                    Preços: {includeCost ? 'Visíveis' : 'Ocultos'}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full border ${allowApproval ? 'bg-indigo-100 dark:bg-indigo-900/60 border-indigo-300 text-indigo-800 dark:text-indigo-200' : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-300 text-neutral-700 dark:text-neutral-300'}`}>
                    Aprovação: {allowApproval ? 'Habilitada' : 'Desabilitada (Somente Leitura)'}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Link Público Read-Only:
                </label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`${window.location.origin}/shared/${generatedShareToken}`}
                    className="text-xs font-mono bg-neutral-50 dark:bg-neutral-850"
                  />
                  <Button
                    onClick={copyToClipboard}
                    className="shrink-0 gap-1 text-xs cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span style={{ color: '#000000' }}>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span style={{ color: '#000000' }}>Copiar</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {generatedApprovalCode && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Código de Aprovação (Enviar para o cliente):
                  </label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={generatedApprovalCode}
                      className="text-xs font-mono font-bold tracking-wider text-indigo-600 dark:text-indigo-400 bg-neutral-50 dark:bg-neutral-850"
                    />
                    <Button
                      onClick={copyApprovalCode}
                      className="shrink-0 gap-1 text-xs cursor-pointer"
                    >
                      {approvalCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span style={{ color: '#000000' }}>Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span style={{ color: '#000000' }}>Copiar Código</span>
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-2xs text-neutral-500 dark:text-neutral-400">
                    O cliente precisará digitar este código na página pública para aprovar ou rejeitar os apontamentos.
                  </p>
                </div>
              )}

              {!allowApproval && (
                <div className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850/60 text-2xs text-neutral-600 dark:text-neutral-400">
                  <strong>Aprovação desativada:</strong> Este relatório é estritamente informativo (somente leitura). O cliente não verá campos de assinatura e nenhum código é necessário.
                </div>
              )}

              <div className="pt-3 flex justify-between items-center">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setGeneratedShareToken(null);
                    setGeneratedApprovalCode(null);
                  }}
                  className="text-xs text-neutral-500 dark:text-neutral-400 cursor-pointer"
                >
                  Gerar outro link
                </Button>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (generatedShareToken) {
                        window.open(`/shared/${generatedShareToken}`, '_blank');
                      }
                    }}
                    className="text-xs gap-1.5 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Visualizar como Cliente</span>
                  </Button>
                  <Button
                    onClick={() => setSharingSession(null)}
                    className="text-xs bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 cursor-pointer"
                  >
                    Concluir
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}
