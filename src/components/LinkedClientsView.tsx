import React, { useState } from 'react';
import {
  Building2,
  User as UserIcon,
  Mail,
  Clock,
  Calendar,
  Lock,
  Search,
  CheckCircle2,
  Info,
  ExternalLink,
  ShieldCheck,
  Briefcase,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { LinkedClientItem } from '../types';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface LinkedClientsViewProps {
  linkedClients: LinkedClientItem[];
  userEmail: string;
  loading?: boolean;
  onRefresh?: () => void;
  onGoToTimer?: () => void;
}

export function LinkedClientsView({
  linkedClients,
  userEmail,
  loading = false,
  onRefresh,
  onGoToTimer,
}: LinkedClientsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSessionsId, setExpandedSessionsId] = useState<string | null>(null);

  const filteredClients = linkedClients.filter((item) => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      item.client.name.toLowerCase().includes(q) ||
      (item.client.company && item.client.company.toLowerCase().includes(q)) ||
      item.workspace.name.toLowerCase().includes(q) ||
      item.owner.name.toLowerCase().includes(q) ||
      item.owner.email.toLowerCase().includes(q)
    );
  });

  const toggleSessions = (id: string) => {
    setExpandedSessionsId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              Vínculos como Cliente
            </h1>
            <Badge
              variant="outline"
              className="gap-1.5 border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium"
            >
              <Lock className="h-3 w-3" />
              Somente Leitura
            </Badge>
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Workspaces de outros profissionais e empresas onde seu e-mail{' '}
            <strong className="text-neutral-800 dark:text-neutral-200">{userEmail}</strong> está cadastrado como cliente ou contato.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Badge className="bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-semibold px-3 py-1">
            {linkedClients.length} {linkedClients.length === 1 ? 'vínculo ativo' : 'vínculos ativos'}
          </Badge>
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
              className="text-xs"
            >
              Atualizar
            </Button>
          )}
        </div>
      </div>

      {/* Explanatory Banner */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 p-4 sm:p-5">
        <div className="flex items-start gap-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Sobre esta área de acesso compartilhado
            </h2>
            <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Você possui visualização destes registros porque o proprietário de cada workspace adicionou seu e-mail como cliente.
              Esta área é estritamente de <strong>leitura e acompanhamento</strong>: novos apontamentos de horas, alteração de dados cadastrais
              e faturamento são gerenciados diretamente pelo dono de cada workspace.
            </p>
          </div>
        </div>
      </div>

      {/* Search Filter */}
      {linkedClients.length > 1 && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <Input
            type="text"
            placeholder="Filtrar por cliente, workspace ou dono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>
      )}

      {/* Empty State */}
      {linkedClients.length === 0 && !loading && (
        <div className="text-center py-16 px-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 mb-4">
            <Briefcase className="h-7 w-7" />
          </div>
          <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
            Nenhum vínculo de cliente localizado
          </h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md mx-auto mb-6">
            O endereço de e-mail <strong className="text-neutral-700 dark:text-neutral-300">{userEmail}</strong> não está associado a cadastros de clientes em outros workspaces do Cronos no momento.
          </p>
          {onGoToTimer && (
            <Button onClick={onGoToTimer} variant="default">
              Ir para o Cronômetro
            </Button>
          )}
        </div>
      )}

      {/* Filtered empty state */}
      {linkedClients.length > 0 && filteredClients.length === 0 && (
        <div className="text-center py-12 px-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Nenhum vínculo corresponde ao filtro "{searchTerm}".
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchTerm('')}
            className="mt-3 text-xs"
          >
            Limpar filtro
          </Button>
        </div>
      )}

      {/* List of Linked Clients */}
      <div className="space-y-6">
        {filteredClients.map((item) => {
          const isExpanded = expandedSessionsId === item.id;
          const sessions = item.stats.recent_sessions || [];

          return (
            <div
              key={item.id}
              className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden shadow-2xs transition-colors"
            >
              {/* Card Header */}
              <div className="p-5 sm:p-6 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-neutral-100">
                        {item.client.name}
                      </h3>
                      {item.client.company && (
                        <span className="flex items-center gap-1 text-xs font-medium text-neutral-600 dark:text-neutral-400 bg-neutral-200/70 dark:bg-neutral-800 px-2 py-0.5 rounded-md">
                          <Building2 className="h-3 w-3" />
                          {item.client.company}
                        </span>
                      )}
                      <Badge
                        variant="secondary"
                        className="text-[11px] font-medium"
                      >
                        {item.matched_as === 'contact' && item.contact
                          ? `Contato: ${item.contact.name}${item.contact.role ? ` (${item.contact.role})` : ''}`
                          : 'Cliente Direto'}
                      </Badge>
                    </div>

                    {item.client.email && (
                      <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                        <Mail className="h-3 w-3" />
                        <span>{item.client.email}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="h-3 w-3" />
                      Vínculo Ativo
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Body: Workspace & Owner Grid */}
              <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-5 border-b border-neutral-200 dark:border-neutral-800">
                {/* Workspace Info */}
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 bg-neutral-50 dark:bg-neutral-800/30">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
                    <Layers className="h-3.5 w-3.5" />
                    <span>Workspace Vinculado</span>
                  </div>
                  <h4 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                    {item.workspace.name}
                  </h4>
                  {item.workspace.description && (
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 line-clamp-2">
                      {item.workspace.description}
                    </p>
                  )}
                  <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800/60 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                    <span>Organização:</span>
                    <strong className="text-neutral-700 dark:text-neutral-300 font-medium">
                      {item.tenant.name}
                    </strong>
                  </div>
                </div>

                {/* Workspace Owner Info */}
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 bg-neutral-50 dark:bg-neutral-800/30">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
                    <UserIcon className="h-3.5 w-3.5" />
                    <span>Dono do Workspace</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-bold text-sm">
                      {item.owner.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold text-neutral-900 dark:text-neutral-100 truncate">
                          {item.owner.name}
                        </h4>
                        <Badge variant="outline" className="text-[10px] font-semibold uppercase px-1.5 py-0 h-4">
                          {item.owner.role}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400 truncate">
                        <Mail className="h-3 w-3 shrink-0" />
                        <span className="truncate">{item.owner.email}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats & Session History Summary */}
              <div className="p-5 sm:p-6 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3 bg-white dark:bg-neutral-900">
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 block">
                      Horas Apontadas
                    </span>
                    <span className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-neutral-100">
                      {item.stats.total_hours_formatted}
                    </span>
                  </div>

                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3 bg-white dark:bg-neutral-900">
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 block">
                      Sessões Realizadas
                    </span>
                    <span className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-neutral-100">
                      {item.stats.total_sessions}
                    </span>
                  </div>

                  <div className="col-span-2 sm:col-span-1 rounded-lg border border-neutral-200 dark:border-neutral-800 p-3 bg-white dark:bg-neutral-900 flex flex-col justify-center">
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 block">
                      Permissão de Acesso
                    </span>
                    <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1 mt-0.5">
                      <Lock className="h-3 w-3" /> Apenas Leitura
                    </span>
                  </div>
                </div>

                {/* Session List Toggle */}
                {sessions.length > 0 ? (
                  <div>
                    <button
                      type="button"
                      onClick={() => toggleSessions(item.id)}
                      className="flex items-center gap-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 py-1 cursor-pointer transition-colors"
                    >
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        {isExpanded ? 'Ocultar apontamentos recentes' : `Ver ${sessions.length} apontamento(s) recente(s)`}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="mt-3 rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden text-xs">
                        <div className="bg-neutral-100 dark:bg-neutral-800/60 px-3 py-2 font-semibold text-neutral-700 dark:text-neutral-300 grid grid-cols-12 gap-2">
                          <span className="col-span-4 sm:col-span-3">Início</span>
                          <span className="col-span-5 sm:col-span-6">Descrição / Tarefa</span>
                          <span className="col-span-3 text-right">Duração</span>
                        </div>
                        <div className="divide-y divide-neutral-200 dark:divide-neutral-800 bg-white dark:bg-neutral-900">
                          {sessions.map((s) => (
                            <div key={s.id} className="px-3 py-2.5 grid grid-cols-12 gap-2 items-center">
                              <span className="col-span-4 sm:col-span-3 text-neutral-600 dark:text-neutral-400">
                                {s.start_time
                                  ? new Date(s.start_time).toLocaleString('pt-BR', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: '2-digit',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                  : '—'}
                              </span>
                              <span className="col-span-5 sm:col-span-6 text-neutral-900 dark:text-neutral-100 font-medium truncate">
                                {s.title}
                              </span>
                              <span className="col-span-3 text-right font-semibold text-neutral-800 dark:text-neutral-200">
                                {s.duration_formatted}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 italic">
                    Nenhum apontamento de horas registrado ainda neste cliente pelo workspace.
                  </p>
                )}

                {/* Footer read-only reminder */}
                <div className="pt-2 flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                  <Info className="h-3 w-3 shrink-0" />
                  <span>
                    Qualquer alteração ou novo registro é de responsabilidade exclusiva do dono deste workspace ({item.owner.name}).
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
