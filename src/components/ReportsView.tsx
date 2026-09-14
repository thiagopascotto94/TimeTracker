import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Share2,
  DollarSign,
  Clock,
  CheckCircle2,
  Filter,
  Copy,
  Check,
  ExternalLink,
  FileText,
  ChevronDown,
  ChevronUp,
  Link2,
  Building2,
  Briefcase,
  Lock,
} from 'lucide-react';
import dayjs from 'dayjs';
import { ReportData, TimeSession, Client } from '../types';
import {
  formatCurrency,
  formatDateTime,
  formatDateOnly,
  formatDurationHuman,
} from '../utils/format';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Dialog } from './ui/dialog';
import { useToast } from './ui/toast';
import { ClientFilterAutocomplete } from './ClientFilterAutocomplete';
import { apiFetch } from '../utils/api';

interface ReportsViewProps {
  hourlyRate: number;
  clients: Client[];
  onOpenPublicShare: (token: string) => void;
}

export function ReportsView({ hourlyRate, clients, onOpenPublicShare }: ReportsViewProps) {
  const { addToast } = useToast();
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Filter state
  const [preset, setPreset] = useState<'all' | 'today' | '7days' | 'month'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [clientId, setClientId] = useState<string>('');

  // Expandable sessions
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});
  const [expandedSessionNotes, setExpandedSessionNotes] = useState<Record<string, boolean>>({});
  const [expandedTaskNotes, setExpandedTaskNotes] = useState<Record<string, boolean>>({});

  const toggleSessionNote = (sessionId: string) => {
    setExpandedSessionNotes((prev) => ({ ...prev, [sessionId]: !prev[sessionId] }));
  };

  const toggleTaskNote = (taskId: string) => {
    setExpandedTaskNotes((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  // Share Dialog state
  const [shareDialogOpen, setShareDialogOpen] = useState<boolean>(false);
  const [shareTitle, setShareTitle] = useState<string>('Relatório de Horas & Faturamento');
  const [includeCost, setIncludeCost] = useState<boolean>(true);
  const [allowApproval, setAllowApproval] = useState<boolean>(true);
  const [selectedSessionIdForShare, setSelectedSessionIdForShare] = useState<string>('');
  const [generatedShareToken, setGeneratedShareToken] = useState<string | null>(null);
  const [generatedApprovalCode, setGeneratedApprovalCode] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [approvalCopied, setApprovalCopied] = useState<boolean>(false);

  // Fetch report data
  const fetchReport = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (clientId) params.append('clientId', clientId);

      const res = await apiFetch(`/api/reports?${params.toString()}`);
      if (!res.ok) throw new Error('Falha ao obter relatório');
      const data = await res.json();
      setReportData(data);
    } catch (err: any) {
      console.error(err);
      addToast({
        title: 'Erro ao carregar relatório',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [startDate, endDate, clientId]);

  // Apply quick date preset
  const handlePreset = (p: 'all' | 'today' | '7days' | 'month') => {
    setPreset(p);
    const today = dayjs();
    if (p === 'today') {
      const todayStr = today.format('YYYY-MM-DD');
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (p === '7days') {
      setStartDate(today.subtract(6, 'day').format('YYYY-MM-DD'));
      setEndDate(today.format('YYYY-MM-DD'));
    } else if (p === 'month') {
      setStartDate(today.startOf('month').format('YYYY-MM-DD'));
      setEndDate(today.endOf('month').format('YYYY-MM-DD'));
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  const toggleSessionExpand = (id: string) => {
    setExpandedSessions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Generate public token (RF08)
  const handleCreateShareToken = async () => {
    try {
      setShareLoading(true);
      const payload: any = {
        title: shareTitle,
        start_date: startDate || null,
        end_date: endDate || null,
        session_id: selectedSessionIdForShare || null,
        client_id: clientId || null,
        include_cost: includeCost,
        allow_approval: allowApproval,
      };

      const res = await apiFetch('/api/reports/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Falha ao gerar link de compartilhamento');
      const data = await res.json();
      setGeneratedShareToken(data.token);
      setGeneratedApprovalCode(data.approval_code);

      addToast({
        title: 'Link Público Gerado!',
        description: 'Você pode enviar este link e o código de aprovação para seu cliente.',
        variant: 'success',
      });
    } catch (err: any) {
      addToast({
        title: 'Erro',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setShareLoading(false);
    }
  };

  const fullShareUrl = generatedShareToken
    ? `${window.location.origin}/shared/${generatedShareToken}`
    : '';

  const copyToClipboard = () => {
    if (!fullShareUrl) return;
    navigator.clipboard.writeText(fullShareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
    addToast({
      title: 'Link copiado!',
      description: 'Copiado para a área de transferência.',
      variant: 'default',
    });
  };

  const copyApprovalCode = () => {
    if (!generatedApprovalCode) return;
    navigator.clipboard.writeText(generatedApprovalCode);
    setApprovalCopied(true);
    setTimeout(() => setApprovalCopied(false), 3000);
    addToast({
      title: 'Código copiado!',
      description: 'Código de aprovação copiado para a área de transferência.',
      variant: 'default',
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Relatórios &amp; Faturamento
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Extrato detalhado de horas trabalhadas com cálculo de precificação por hora.
          </p>
        </div>

        {/* Share Button (RF08) */}
        <Button
          onClick={() => {
            setGeneratedShareToken(null);
            setSelectedSessionIdForShare('');
            setShareDialogOpen(true);
          }}
          className="gap-2 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 shadow-sm shrink-0 cursor-pointer"
        >
          <Share2 className="w-4 h-4" />
          <span>Compartilhar Relatório</span>
        </Button>
      </div>

      {/* Date Filters Card */}
      <Card className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mr-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" />
                Filtrar:
              </span>
              {[
                { label: 'Todo o Período', val: 'all' },
                { label: 'Hoje', val: 'today' },
                { label: 'Últimos 7 dias', val: '7days' },
                { label: 'Este Mês', val: 'month' },
              ].map((p) => (
                <button
                  key={p.val}
                  type="button"
                  onClick={() => handlePreset(p.val as any)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
                    preset === p.val
                      ? 'border-neutral-900 dark:border-neutral-100 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 shadow-2xs'
                      : 'border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-850 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Client Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5" />
                Cliente:
              </span>
              <ClientFilterAutocomplete
                clients={clients}
                selectedClientId={clientId}
                onSelectClient={setClientId}
                allLabel="Todos os Clientes"
                allValue=""
              />
            </div>

            {/* Custom Dates */}
            <div className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1">
                <span className="text-neutral-500 dark:text-neutral-400">De:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setPreset('all');
                    setStartDate(e.target.value);
                  }}
                  className="rounded-md border border-neutral-300 dark:border-neutral-600 px-2.5 py-1 text-xs font-medium text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-200"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-neutral-500 dark:text-neutral-400">Até:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setPreset('all');
                    setEndDate(e.target.value);
                  }}
                  className="rounded-md border border-neutral-300 dark:border-neutral-600 px-2.5 py-1 text-xs font-medium text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-200"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SUMMARY STATS CARDS (RF07) */}
      {reportData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Horas Totais */}
          <Card className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Total de Horas
                </span>
                <Clock className="w-4 h-4 text-neutral-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-neutral-900 dark:text-neutral-100 font-mono">
                {reportData.summary.totalDecimalHours.toFixed(2)}h
              </div>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {formatDurationHuman(reportData.summary.totalDurationMs)} de tempo produtivo
              </p>
            </CardContent>
          </Card>

          {/* Card 2: Faturamento Total */}
          <Card className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Valor a Faturar
                </span>
                <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                {formatCurrency(reportData.summary.totalBillableAmount)}
              </div>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Soma exata calculada por sessão/cliente
              </p>
            </CardContent>
          </Card>

          {/* Card 3: Valor por Hora */}
          <Card className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  {reportData.summary.selectedClient
                    ? 'Taxa do Cliente'
                    : 'Taxa(s) por Cliente'}
                </span>
                <Building2 className="w-4 h-4 text-neutral-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-neutral-900 dark:text-neutral-100 font-mono">
                {reportData.summary.selectedClient ? (
                  formatCurrency(reportData.summary.selectedClient.hourly_rate ?? reportData.summary.hourlyRate)
                ) : (
                  <span className="text-lg">Por Sessão / Cliente</span>
                )}
              </div>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {reportData.summary.selectedClient
                  ? `Cliente: ${reportData.summary.selectedClient.name}`
                  : `Precificação individual aplicada em cada sessão`}
              </p>
            </CardContent>
          </Card>

          {/* Card 4: Sessões e Tarefas */}
          <Card className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Atividades
                </span>
                <CheckCircle2 className="w-4 h-4 text-neutral-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-neutral-900 dark:text-neutral-100 font-mono">
                {reportData.summary.totalSessionsCount}
              </div>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {reportData.summary.totalTasksCount} anotações registradas
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* SESSIONS & TASKS DETAILED LIST */}
      <Card className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs">
        <CardHeader className="pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                Detalhamento das Sessões de Tempo
              </CardTitle>
              <CardDescription className="text-xs text-neutral-500 dark:text-neutral-400">
                Extrato detalhado com tarefas executadas e precificação proporcional.
              </CardDescription>
            </div>
            {reportData && (
              <Badge variant="outline" className="text-xs">
                {reportData.sessions.length} sessões encontradas
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-sm text-neutral-400 dark:text-neutral-500">
              Carregando dados do relatório...
            </div>
          ) : !reportData || reportData.sessions.length === 0 ? (
            <div className="py-12 text-center text-sm text-neutral-400 dark:text-neutral-500">
              Nenhuma sessão registrada no período selecionado.
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {reportData.sessions.map((sess) => {
                const isExpanded = expandedSessions[sess.id];
                const taskList = sess.tasks || sess.Tasks || [];
                const metrics = sess.metrics!;

                return (
                  <div key={sess.id} className="p-4 sm:p-5 transition-colors hover:bg-neutral-50/50 dark:hover:bg-neutral-850/50">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Title & Info */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
                            {sess.title}
                          </h4>
                          {sess.is_locked && (
                            <Badge
                              variant="outline"
                              className="text-2xs gap-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                              title={sess.locked_reason || 'Sessão aprovada no relatório e bloqueada para edições'}
                            >
                              <Lock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span>Aprovada</span>
                            </Badge>
                          )}
                          {metrics.isActive && (
                            <Badge variant="amber" className="text-2xs uppercase">
                              Em Andamento
                            </Badge>
                          )}
                          {sess.target_minutes && (
                            <Badge variant="outline" className="text-2xs">
                              Meta: {sess.target_minutes}m
                            </Badge>
                          )}
                          {sess.Client && (
                            <Badge variant="secondary" className="text-2xs gap-1 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800">
                              <Briefcase className="w-3 h-3" />
                              {sess.Client.name}
                            </Badge>
                          )}
                          {sess.hourly_rate !== null && sess.hourly_rate !== undefined && (
                            <Badge
                              variant="outline"
                              className="text-2xs font-mono text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30"
                              title="Taxa personalizada definida para esta sessão"
                            >
                              R$ {Number(sess.hourly_rate).toFixed(2)}/h
                            </Badge>
                          )}
                          {sess.notes && (
                            <button
                              type="button"
                              onClick={() => toggleSessionNote(sess.id)}
                              className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer"
                              title="Clique para exibir ou ocultar as observações da sessão de cronômetro"
                            >
                              <FileText className="w-2.5 h-2.5 text-indigo-600 dark:text-indigo-400" />
                              <span>Observação da Sessão</span>
                            </button>
                          )}
                        </div>

                        {sess.notes && expandedSessionNotes[sess.id] && (
                          <div className="mt-1.5 p-2 rounded-md bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-800/50 text-xs text-indigo-950 dark:text-indigo-200 whitespace-pre-wrap leading-relaxed shadow-2xs">
                            <span className="font-semibold text-2xs text-indigo-800 dark:text-indigo-300 block mb-0.5 uppercase tracking-wide">
                              Observações da sessão de cronômetro:
                            </span>
                            {sess.notes}
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 flex-wrap">
                          <span>{formatDateTime(sess.start_time)}</span>
                          {sess.end_time && (
                            <>
                              <span>→</span>
                              <span>{formatDateTime(sess.end_time)}</span>
                            </>
                          )}
                          {sess.previous_session && (
                            <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium">
                              <Link2 className="w-3 h-3" />
                              Cont. de: {sess.previous_session.title}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Numbers & Expand */}
                      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                        <div className="text-right">
                          <div className="text-sm font-mono font-bold text-neutral-900 dark:text-neutral-100">
                            {metrics.decimalHours.toFixed(2)}h
                            <span className="text-xs font-normal text-neutral-400 ml-1">
                              ({formatDurationHuman(metrics.durationMs)})
                            </span>
                          </div>
                          <div className="flex items-center justify-end gap-1.5 mt-0.5">
                            <span className="text-2xs font-mono text-neutral-500 dark:text-neutral-400">
                              @{formatCurrency(metrics.appliedHourlyRate ?? metrics.hourlyRate ?? (sess.Client?.hourly_rate ?? reportData.summary.hourlyRate))}/h =
                            </span>
                            <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400">
                              {formatCurrency(metrics.billableAmount)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleSessionExpand(sess.id)}
                            className="h-8 px-2 text-neutral-600 dark:text-neutral-300 gap-1 text-xs"
                          >
                            <span>{taskList.length} tarefas</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Expandable Tasks list */}
                    {isExpanded && (
                      <div className="mt-3 pl-4 sm:pl-6 border-l-2 border-neutral-200 dark:border-neutral-750 space-y-2 py-1">
                        <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block">
                          Tarefas desta sessão:
                        </span>
                        {taskList.length === 0 ? (
                          <p className="text-xs text-neutral-400 italic">
                            Nenhuma anotação de tarefa foi registrada para esta sessão.
                          </p>
                        ) : (
                          <ul className="space-y-1.5">
                            {taskList.map((t) => (
                              <li
                                key={t.id}
                                className="text-xs text-neutral-700 dark:text-neutral-300"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-start gap-2 flex-1 min-w-0">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                                    <span className="leading-relaxed break-words">{t.description}</span>
                                  </div>
                                  {t.notes && (
                                    <button
                                      type="button"
                                      onClick={() => toggleTaskNote(t.id)}
                                      className="shrink-0 inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors cursor-pointer"
                                      title="Clique para exibir ou ocultar a observação desta tarefa"
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
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer Summary in Statement */}
          {reportData && reportData.sessions.length > 0 && (
            <div className="p-4 sm:p-5 bg-neutral-50/80 dark:bg-neutral-850/80 border-t border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 gap-3">
              <span>
                Total de {reportData.sessions.length} {reportData.sessions.length === 1 ? 'sessão listada' : 'sessões listadas'} • Precificação calculada por sessão/cliente
              </span>
              <div className="flex items-center gap-4 flex-wrap">
                <span className="font-mono text-neutral-700 dark:text-neutral-300">
                  Horas: <strong>{reportData.summary.totalDecimalHours.toFixed(2)}h</strong>
                </span>
                <div className="font-medium text-neutral-900 dark:text-neutral-100">
                  Total Final a Faturar: <strong className="text-emerald-700 dark:text-emerald-400 text-base font-mono ml-1">{formatCurrency(reportData.summary.totalBillableAmount)}</strong>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SHARE REPORT MODAL (RF08) */}
      <Dialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        title="Compartilhar Relatório Público"
        description="Gere um token com link somente-leitura (read-only) para seu cliente acompanhar as horas e faturamento."
      >
        <div className="space-y-4 pt-2">
          {!generatedShareToken ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Título do Relatório Compartilhado
                </label>
                <Input
                  value={shareTitle}
                  onChange={(e) => setShareTitle(e.target.value)}
                  placeholder="Ex: Prestação de Contas - Projeto E-commerce"
                  className="text-sm"
                  style={{ color: '#000000' }}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Escopo do Compartilhamento
                </label>
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-750 bg-neutral-50 dark:bg-neutral-850 p-3 text-xs text-neutral-600 dark:text-neutral-300 space-y-2">
                  <p>
                    <strong>Filtro Atual:</strong>{' '}
                    {startDate || endDate
                      ? `De ${startDate || 'Início'} até ${endDate || 'Hoje'}`
                      : 'Todo o histórico de trabalho'}
                  </p>
                  {clientId ? (
                    <p>
                      <strong>Cliente Filtrado:</strong> {clients.find((c) => c.id === clientId)?.name || 'Selecionado'} (Taxa: {formatCurrency(reportData?.summary?.hourlyRate ?? hourlyRate)}/h)
                    </p>
                  ) : (
                    <p>
                      <strong>Cálculo:</strong> Baseado nas taxas individuais por sessão/cliente ({reportData?.summary?.hasMultipleRates ? 'múltiplas taxas aplicadas' : `taxa base ${formatCurrency(hourlyRate)}/h`})
                    </p>
                  )}
                  <p className="text-emerald-700 dark:text-emerald-400 font-medium">
                    <strong>Total a Faturar:</strong> {formatCurrency(reportData?.summary?.totalBillableAmount ?? 0)}
                  </p>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShareDialogOpen(false)}
                  className="text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreateShareToken}
                  disabled={shareLoading || !shareTitle.trim()}
                  className="text-xs gap-1.5 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{shareLoading ? 'Gerando...' : 'Gerar Link Público'}</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/60 p-3 text-xs text-emerald-900 dark:text-emerald-200">
                <div className="font-semibold flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Link criado com sucesso!
                </div>
                <p className="mt-1">
                  Qualquer pessoa com este link poderá visualizar as horas e faturamento sem precisar de login.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Link Público Read-Only:
                </label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={fullShareUrl}
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



              <div className="pt-3 flex justify-between items-center">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setGeneratedShareToken(null);
                    setGeneratedApprovalCode(null);
                  }}
                  className="text-xs text-neutral-500 dark:text-neutral-400"
                >
                  Gerar outro link
                </Button>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShareDialogOpen(false);
                      onOpenPublicShare(generatedShareToken);
                    }}
                    className="text-xs gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Visualizar como Cliente</span>
                  </Button>
                  <Button
                    onClick={() => setShareDialogOpen(false)}
                    className="text-xs bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
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
