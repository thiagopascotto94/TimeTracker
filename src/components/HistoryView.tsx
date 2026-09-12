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

interface HistoryViewProps {
  sessions: TimeSession[];
  hourlyRate: number;
  clients: Client[];
  onResumeSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => Promise<void>;
  onShareSession: (sessionId: string) => void;
  loading: boolean;
}

export function HistoryView({
  sessions,
  hourlyRate,
  clients,
  onResumeSession,
  onDeleteSession,
  onShareSession,
  loading,
}: HistoryViewProps) {
  const { addToast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
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
          Visualize todas as sessões registradas, continue trabalhos anteriores ou compartilhe registros individuais.
        </p>
      </div>

      <Card className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs">
        <CardHeader className="pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              Registro Cronológico
            </CardTitle>
            <div className="flex items-center gap-2">
              <select
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                className="text-xs rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2.5 py-1 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-neutral-400"
              >
                <option value="all">Todos os Clientes</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
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
                const rate = clientObj?.hourly_rate ?? hourlyRate;
                const billable = decimalHours * rate;
                const tasks = s.Tasks || s.tasks || [];
                const isExpanded = expandedId === s.id;

                return (
                  <div
                    key={s.id}
                    className="p-4 sm:p-5 hover:bg-neutral-50/50 dark:hover:bg-neutral-850/50 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Left: Info */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
                            {s.title}
                          </h4>
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
                            <Badge variant="secondary" className="text-2xs gap-1 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800">
                              <Briefcase className="w-3 h-3" />
                              {clientObj.name}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 flex-wrap">
                          <span>{formatDateTime(s.start_time)}</span>
                          {s.end_time && (
                            <>
                              <span>→</span>
                              <span>{formatDateTime(s.end_time)}</span>
                            </>
                          )}
                          {s.previous_session_id && (
                            <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium">
                              <Link2 className="w-3 h-3" />
                              Continuação
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Metrics & Actions */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        <div className="text-right">
                          <div className="text-sm font-mono font-bold text-neutral-900 dark:text-neutral-100">
                            {decimalHours.toFixed(2)}h
                            <span className="text-xs font-normal text-neutral-400 ml-1">
                              ({formatDurationHuman(durationMs)})
                            </span>
                          </div>
                          <div className="text-xs font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                            {formatCurrency(billable)}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {/* Resume/Continue button (RF06) */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onResumeSession(s.id)}
                            className="h-8 px-2.5 text-xs gap-1 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                            title="Continuar este trabalho em uma nova sessão"
                          >
                            <Play className="w-3 h-3 fill-current text-indigo-600 dark:text-indigo-400" />
                            <span className="hidden sm:inline">Continuar</span>
                          </Button>

                          {/* Share single session */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onShareSession(s.id)}
                            className="h-8 w-8 p-0 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
                            title="Compartilhar esta sessão"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </Button>

                          {/* Expand tasks */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpand(s.id)}
                            className="h-8 w-8 p-0 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
                            title="Ver anotações"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </Button>

                          {/* Delete session */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteSessionId(s.id)}
                            className="h-8 w-8 p-0 text-neutral-400 hover:text-red-600 dark:hover:text-red-400"
                            title="Excluir sessão"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Expandable tasks */}
                    {isExpanded && (
                      <div className="mt-3 pl-4 border-l-2 border-neutral-200 dark:border-neutral-750 py-1 space-y-1.5">
                        <span className="text-2xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block">
                          Tarefas registradas ({tasks.length}):
                        </span>
                        {tasks.length === 0 ? (
                          <p className="text-xs text-neutral-400 italic">
                            Nenhuma tarefa cadastrada nesta sessão.
                          </p>
                        ) : (
                          <ul className="space-y-1">
                            {tasks.map((t) => (
                              <li
                                key={t.id}
                                className="text-xs text-neutral-700 dark:text-neutral-300 flex items-start gap-1.5"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                                <span>{t.description}</span>
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
    </div>
  );
}
