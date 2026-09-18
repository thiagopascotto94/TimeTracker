import React, { useState, useEffect, useMemo } from 'react';
import {
  Share2,
  CheckCircle2,
  Clock,
  XCircle,
  ShieldCheck,
  Search,
  Filter,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  Lock,
  Unlock,
  RefreshCw,
  FileText,
  Calendar,
  Briefcase,
  AlertCircle,
  Eye,
  Globe,
  SlidersHorizontal,
  Info,
  UserCheck,
  Network,
  Hash,
} from 'lucide-react';
import { ManagedSharedReport, Client } from '../types';
import { formatDateTime, formatDateOnly, formatCurrency } from '../utils/format';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { Dialog } from './ui/dialog';
import { useToast } from './ui/toast';
import { apiFetch } from '../utils/api';

interface SharedReportsManagerProps {
  clients: Client[];
  onOpenPublicShare: (token: string) => void;
  onOpenNewShare?: () => void;
}

export function SharedReportsManager({
  clients,
  onOpenPublicShare,
  onOpenNewShare,
}: SharedReportsManagerProps) {
  const { addToast } = useToast();
  const [reports, setReports] = useState<ManagedSharedReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');
  const [clientFilter, setClientFilter] = useState<string>('');

  // Active Audit Detail Modal
  const [selectedAuditReport, setSelectedAuditReport] = useState<ManagedSharedReport | null>(null);

  // Revoke confirmation modal
  const [reportToRevoke, setReportToRevoke] = useState<ManagedSharedReport | null>(null);
  const [revoking, setRevoking] = useState<boolean>(false);

  // Copy feedbacks
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // Fetch shared reports list
  const fetchSharedReports = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (clientFilter) {
        params.append('clientId', clientFilter);
      }

      const res = await apiFetch(`/api/reports/shared-links?${params.toString()}`);
      if (!res.ok) throw new Error('Falha ao obter relatórios compartilhados');
      const data = await res.json();
      setReports(data.reports || []);
    } catch (err: any) {
      console.error('Error fetching shared reports:', err);
      addToast({
        title: 'Erro ao carregar relatórios',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSharedReports();
  }, [statusFilter, clientFilter]);

  // Copy full public link
  const copyLink = (token: string, id: string) => {
    const fullUrl = `${window.location.origin}/shared/${token}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedTokenId(id);
    addToast({
      title: 'Link copiado!',
      description: 'URL de compartilhamento copiada para a área de transferência.',
    });
    setTimeout(() => setCopiedTokenId(null), 2500);
  };

  // Copy approval code
  const copyApprovalCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    addToast({
      title: 'Código copiado!',
      description: `Código "${code}" copiado.`,
    });
    setTimeout(() => setCopiedCodeId(null), 2500);
  };

  // Revoke / Delete report link
  const handleRevokeReport = async () => {
    if (!reportToRevoke) return;
    try {
      setRevoking(true);
      const res = await apiFetch(`/api/reports/shared-links/${reportToRevoke.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Falha ao revogar link compartilhado');
      addToast({
        title: 'Link revogado com sucesso',
        description: 'O link foi cancelado e o relatório não está mais acessível publicamente.',
      });
      setReports((prev) => prev.filter((r) => r.id !== reportToRevoke.id));
      if (selectedAuditReport?.id === reportToRevoke.id) {
        setSelectedAuditReport(null);
      }
      setReportToRevoke(null);
    } catch (err: any) {
      console.error(err);
      addToast({
        title: 'Erro ao revogar link',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setRevoking(false);
    }
  };

  // Toggle allow approval
  const handleToggleApproval = async (report: ManagedSharedReport) => {
    try {
      const res = await apiFetch(`/api/reports/shared-links/${report.id}/toggle-approval`, {
        method: 'PATCH',
      });
      if (!res.ok) throw new Error('Falha ao alterar permissão');
      const data = await res.json();
      addToast({
        title: 'Permissão atualizada',
        description: data.message,
      });
      setReports((prev) =>
        prev.map((r) => (r.id === report.id ? { ...r, allow_approval: data.allow_approval } : r))
      );
      if (selectedAuditReport?.id === report.id) {
        setSelectedAuditReport((prev) => (prev ? { ...prev, allow_approval: data.allow_approval } : null));
      }
    } catch (err: any) {
      console.error(err);
      addToast({
        title: 'Erro ao atualizar permissão',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  // Metrics summary
  const metrics = useMemo(() => {
    const total = reports.length;
    const approved = reports.filter((r) => r.status === 'approved').length;
    const pending = reports.filter((r) => r.status === 'pending').length;
    const rejected = reports.filter((r) => r.status === 'rejected').length;
    return { total, approved, pending, rejected };
  }, [reports]);

  // Client-side search filtering
  const filteredReports = useMemo(() => {
    if (!searchQuery.trim()) return reports;
    const query = searchQuery.toLowerCase().trim();
    return reports.filter((r) => {
      const titleMatch = r.title?.toLowerCase().includes(query);
      const approverMatch = r.approved_by?.toLowerCase().includes(query);
      const tokenMatch = r.token.toLowerCase().includes(query);
      const clientMatch = r.Client?.name?.toLowerCase().includes(query);
      const ipMatch = r.approval_ip?.toLowerCase().includes(query);
      const codeMatch = r.approval_code?.toLowerCase().includes(query);
      return titleMatch || approverMatch || tokenMatch || clientMatch || ipMatch || codeMatch;
    });
  }, [reports, searchQuery]);

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-200">
      {/* Top Banner & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-neutral-900 p-4 sm:p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>Gerenciamento de Links &amp; Auditoria de Aprovações</span>
            </h3>
            <Badge variant="outline" className="text-xs bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60">
              Auditoria em Tempo Real
            </Badge>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-2xl leading-relaxed">
            Acompanhe o ciclo de vida dos links gerados para clientes, visualizações públicas, assinaturas eletrônicas,
            registro de IPs de auditoria e travamento de sessões faturadas.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchSharedReports}
            disabled={loading}
            className="h-9 gap-1.5 text-xs cursor-pointer"
            title="Recarregar lista"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>

          {onOpenNewShare && (
            <Button
              type="button"
              size="sm"
              onClick={onOpenNewShare}
              className="h-9 gap-1.5 text-xs bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 cursor-pointer shadow-xs font-semibold"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Gerar Novo Link</span>
            </Button>
          )}
        </div>
      </div>

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Links */}
        <Card className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
              <span className="font-medium uppercase tracking-wider">Total de Links</span>
              <Share2 className="w-4 h-4 text-neutral-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-neutral-900 dark:text-neutral-100 font-mono">
              {metrics.total}
            </div>
            <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
              Links compartilhados criados
            </p>
          </CardContent>
        </Card>

        {/* Approved */}
        <Card className="border border-emerald-200/60 dark:border-emerald-900/40 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-2xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400">
              <span className="font-semibold uppercase tracking-wider">Aprovados</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-700 dark:text-emerald-300 font-mono">
              {metrics.approved}
            </div>
            <p className="mt-1 text-[11px] text-emerald-600/80 dark:text-emerald-400/80">
              {metrics.total > 0 ? `${Math.round((metrics.approved / metrics.total) * 100)}% de aprovação` : 'Nenhum relatório'}
            </p>
          </CardContent>
        </Card>

        {/* Pending */}
        <Card className="border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/20 dark:bg-amber-950/10 shadow-2xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-400">
              <span className="font-semibold uppercase tracking-wider">Aguardando Avaliação</span>
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-700 dark:text-amber-300 font-mono">
              {metrics.pending}
            </div>
            <p className="mt-1 text-[11px] text-amber-600/80 dark:text-amber-400/80">
              Pendentes de validação pelo cliente
            </p>
          </CardContent>
        </Card>

        {/* Rejected */}
        <Card className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
              <span className="font-medium uppercase tracking-wider">Rejeitados</span>
              <XCircle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400 font-mono">
              {metrics.rejected}
            </div>
            <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
              Ajustes solicitados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-neutral-900 p-3.5 sm:p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Tab Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" />
              <span>Status:</span>
            </span>
            {[
              { id: 'all', label: 'Todos', count: metrics.total },
              { id: 'approved', label: 'Aprovados', count: metrics.approved },
              { id: 'pending', label: 'Pendentes', count: metrics.pending },
              { id: 'rejected', label: 'Rejeitados', count: metrics.rejected },
            ].map((st) => (
              <Button
                key={st.id}
                type="button"
                size="sm"
                variant={statusFilter === st.id ? 'default' : 'outline'}
                onClick={() => setStatusFilter(st.id as any)}
                className="h-8 px-2.5 text-xs gap-1.5 cursor-pointer"
              >
                <span>{st.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    statusFilter === st.id
                      ? 'bg-white/20 text-white'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  {st.count}
                </span>
              </Button>
            ))}
          </div>

          {/* Client Filter Dropdown */}
          <div className="flex items-center gap-2">
            <Briefcase className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs px-2.5 py-1.5 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">Todos os Clientes</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Text Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por título, aprovador, e-mail, token ou IP de auditoria..."
            className="pl-9 text-xs h-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Main Management Table Card */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-neutral-400 space-y-3">
            <RefreshCw className="w-7 h-7 animate-spin text-indigo-600" />
            <p className="text-xs font-medium">Carregando links e auditorias de relatórios...</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="text-center py-16 px-4 space-y-3">
            <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 flex items-center justify-center mx-auto">
              <Share2 className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              {reports.length === 0
                ? 'Nenhum link de relatório gerado até o momento'
                : 'Nenhum relatório encontrado para os filtros selecionados'}
            </h4>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
              {reports.length === 0
                ? 'Clique no botão "Gerar Novo Link" para criar um link de prestação de contas com auditoria para seus clientes.'
                : 'Tente alterar os termos de busca ou remover os filtros de cliente e status.'}
            </p>
            {onOpenNewShare && reports.length === 0 && (
              <div className="pt-2">
                <Button size="sm" onClick={onOpenNewShare} className="gap-1.5 text-xs cursor-pointer">
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Gerar Primeiro Link de Relatório</span>
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70 text-neutral-600 dark:text-neutral-400 font-semibold">
                  <th className="py-3 px-4">Relatório &amp; Escopo</th>
                  <th className="py-3 px-3">Cliente</th>
                  <th className="py-3 px-3">Link Público</th>
                  <th className="py-3 px-3">Status da Aprovação</th>
                  <th className="py-3 px-4">Trilha de Auditoria</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {filteredReports.map((report) => {
                  const isApproved = report.status === 'approved';
                  const isPending = report.status === 'pending';
                  const isRejected = report.status === 'rejected';

                  return (
                    <tr
                      key={report.id}
                      className="hover:bg-neutral-50/60 dark:hover:bg-neutral-850/50 transition-colors group"
                    >
                      {/* Title & Scope */}
                      <td className="py-3.5 px-4 align-top max-w-[280px]">
                        <div className="flex items-start gap-2">
                          <div
                            className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                              isApproved
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                : isPending
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                                : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                            }`}
                          >
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-neutral-900 dark:text-neutral-100 truncate text-[13px]" title={report.title}>
                              {report.title}
                            </p>

                            {/* Dates / Session Indicator */}
                            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                              {report.session_id ? (
                                <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium">
                                  <Clock className="w-3 h-3" />
                                  <span>Sessão Única</span>
                                </span>
                              ) : report.start_date || report.end_date ? (
                                <span className="inline-flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  <span>
                                    {report.start_date ? formatDateOnly(report.start_date) : 'Início'} até{' '}
                                    {report.end_date ? formatDateOnly(report.end_date) : 'Hoje'}
                                  </span>
                                </span>
                              ) : (
                                <span>Todo o período</span>
                              )}

                              <span>•</span>
                              <span>{formatCurrency(report.hourly_rate)}/h</span>
                            </div>

                            <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">
                              Criado em {formatDateTime(report.created_at)}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Client */}
                      <td className="py-3.5 px-3 align-top">
                        {report.Client ? (
                          <div className="flex items-center gap-1.5 text-neutral-800 dark:text-neutral-200 font-medium">
                            <Briefcase className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                            <span className="truncate max-w-[140px]">{report.Client.name}</span>
                          </div>
                        ) : (
                          <span className="text-neutral-400 text-xs italic">Geral (Todos)</span>
                        )}
                      </td>

                      {/* Public Link / Token */}
                      <td className="py-3.5 px-3 align-top max-w-[180px]">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1">
                            <code className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-[11px] font-mono text-neutral-700 dark:text-neutral-300">
                              {report.token.substring(0, 8)}...
                            </code>

                            <button
                              type="button"
                              onClick={() => copyLink(report.token, report.id)}
                              className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                              title="Copiar link público completo"
                            >
                              {copiedTokenId === report.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => onOpenPublicShare(report.token)}
                              className="p-1 text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                              title="Abrir relatório público"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Approval Code badge if available */}
                          {report.allow_approval && report.approval_code && (
                            <div className="flex items-center gap-1 text-[10px] text-neutral-500 dark:text-neutral-400">
                              <span className="text-neutral-400">Código:</span>
                              <span className="font-mono font-semibold text-neutral-700 dark:text-neutral-300">
                                {report.approval_code}
                              </span>
                              <button
                                type="button"
                                onClick={() => copyApprovalCode(report.approval_code!, report.id)}
                                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                                title="Copiar código"
                              >
                                {copiedCodeId === report.id ? (
                                  <Check className="w-2.5 h-2.5 text-emerald-500" />
                                ) : (
                                  <Copy className="w-2.5 h-2.5" />
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Approval Status */}
                      <td className="py-3.5 px-3 align-top">
                        <div className="space-y-1">
                          {isApproved && (
                            <Badge className="bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 gap-1 text-xs">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Aprovado</span>
                            </Badge>
                          )}
                          {isPending && (
                            <Badge className="bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 gap-1 text-xs">
                              <Clock className="w-3 h-3" />
                              <span>Aguardando</span>
                            </Badge>
                          )}
                          {isRejected && (
                            <Badge className="bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 gap-1 text-xs">
                              <XCircle className="w-3 h-3" />
                              <span>Rejeitado</span>
                            </Badge>
                          )}

                          {/* Approval permission mode */}
                          <div className="pt-0.5">
                            {report.allow_approval ? (
                              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1">
                                <Unlock className="w-2.5 h-2.5" />
                                <span>Aprovação Ativa</span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                                <Lock className="w-2.5 h-2.5" />
                                <span>Apenas Leitura</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Audit Trail Details */}
                      <td className="py-3.5 px-4 align-top max-w-[240px]">
                        {isApproved ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-neutral-900 dark:text-neutral-100 font-semibold truncate">
                              <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span className="truncate" title={report.approved_by || ''}>
                                {report.approved_by || 'Aprovador Autorizado'}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                              <Calendar className="w-3 h-3 shrink-0" />
                              <span>{formatDateTime(report.approved_at)}</span>
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                              <Network className="w-3 h-3 shrink-0 text-neutral-400" />
                              <code className="font-mono text-[10px] text-neutral-600 dark:text-neutral-300">
                                {report.approval_ip || 'IP não registrado'}
                              </code>
                            </div>

                            {/* Lock badge if session locked */}
                            {report.Session?.is_locked && (
                              <div className="pt-0.5">
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-[10px] font-medium text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  <Lock className="w-2.5 h-2.5" />
                                  <span>Sessão Travada</span>
                                </span>
                              </div>
                            )}
                          </div>
                        ) : isRejected ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-rose-700 dark:text-rose-300 font-semibold truncate">
                              <XCircle className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{report.approved_by || 'Contato'}</span>
                            </div>
                            <p className="text-[11px] text-neutral-500">
                              Rejeitado em {formatDateTime(report.approved_at)}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1 text-neutral-400 text-[11px]">
                            <p className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                              <span>Pendente de assinatura</span>
                            </p>
                            <p className="text-[10px]">
                              Sessões serão protegidas após aprovação formal.
                            </p>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Audit Dossier */}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedAuditReport(report)}
                            className="h-8 px-2.5 text-xs gap-1 text-neutral-700 dark:text-neutral-300 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                            title="Ver dossiê de auditoria completo"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span className="hidden xl:inline">Auditoria</span>
                          </Button>

                          {/* Toggle allow approval */}
                          <button
                            type="button"
                            onClick={() => handleToggleApproval(report)}
                            className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                            title={
                              report.allow_approval
                                ? 'Pausar possibilidade de aprovação interativa'
                                : 'Ativar possibilidade de aprovação interativa'
                            }
                          >
                            {report.allow_approval ? (
                              <Unlock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            ) : (
                              <Lock className="w-4 h-4 text-neutral-400" />
                            )}
                          </button>

                          {/* Revoke / Delete Link */}
                          <button
                            type="button"
                            onClick={() => setReportToRevoke(report)}
                            className="p-1.5 text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                            title="Revogar e excluir link público"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* AUDIT DOSSIER MODAL */}
      {selectedAuditReport && (
        <Dialog
          open={Boolean(selectedAuditReport)}
          onOpenChange={(open) => !open && setSelectedAuditReport(null)}
          title="Dossiê de Auditoria & Conformidade do Relatório"
          description="Registro imutável e trilha de auditoria para prestação de contas com o cliente."
          className="max-w-2xl"
        >
          <div className="space-y-4 pt-2 text-xs">
            {/* Report Header Card */}
            <div className="p-3.5 bg-neutral-50 dark:bg-neutral-850 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                  {selectedAuditReport.title}
                </span>
                {selectedAuditReport.status === 'approved' && (
                  <Badge className="bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300 text-xs gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Aprovado</span>
                  </Badge>
                )}
                {selectedAuditReport.status === 'pending' && (
                  <Badge className="bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-300 text-xs gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Aguardando Validação</span>
                  </Badge>
                )}
                {selectedAuditReport.status === 'rejected' && (
                  <Badge className="bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-300 text-xs gap-1">
                    <XCircle className="w-3 h-3" />
                    <span>Rejeitado</span>
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-neutral-600 dark:text-neutral-400">
                <div>
                  <span className="text-neutral-400 block text-[10px]">Cliente:</span>
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                    {selectedAuditReport.Client?.name || 'Todos os Clientes'}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-400 block text-[10px]">Taxa Aplicada:</span>
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                    {formatCurrency(selectedAuditReport.hourly_rate)}/hora
                  </span>
                </div>
                <div>
                  <span className="text-neutral-400 block text-[10px]">Exibição de Custos:</span>
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                    {selectedAuditReport.include_cost ? 'Sim (Valores Visíveis)' : 'Apenas Horas'}
                  </span>
                </div>
              </div>
            </div>

            {/* Audit Evidence Grid */}
            <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Evidências Eletrônicas de Auditoria</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-neutral-700 dark:text-neutral-300">
                {/* Aprovador */}
                <div className="p-2.5 bg-neutral-50 dark:bg-neutral-800/60 rounded-lg border border-neutral-200/60 dark:border-neutral-700/60">
                  <span className="text-neutral-400 block text-[10px]">Aprovador Autorizado</span>
                  <p className="font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">
                    {selectedAuditReport.approved_by || 'Aguardando Aprovação do Cliente'}
                  </p>
                </div>

                {/* Data e Hora */}
                <div className="p-2.5 bg-neutral-50 dark:bg-neutral-800/60 rounded-lg border border-neutral-200/60 dark:border-neutral-700/60">
                  <span className="text-neutral-400 block text-[10px]">Timestamp da Assinatura</span>
                  <p className="font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">
                    {selectedAuditReport.approved_at
                      ? formatDateTime(selectedAuditReport.approved_at)
                      : 'Pendente'}
                  </p>
                </div>

                {/* Endereço IP */}
                <div className="p-2.5 bg-neutral-50 dark:bg-neutral-800/60 rounded-lg border border-neutral-200/60 dark:border-neutral-700/60">
                  <span className="text-neutral-400 block text-[10px]">Endereço IP Gravado</span>
                  <code className="font-mono font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5 block">
                    {selectedAuditReport.approval_ip || 'Aguardando Registro'}
                  </code>
                </div>

                {/* Token / Hash do Relatório */}
                <div className="p-2.5 bg-neutral-50 dark:bg-neutral-800/60 rounded-lg border border-neutral-200/60 dark:border-neutral-700/60">
                  <span className="text-neutral-400 block text-[10px]">Token Criptográfico do Relatório</span>
                  <code className="font-mono text-[11px] text-neutral-900 dark:text-neutral-100 mt-0.5 block truncate" title={selectedAuditReport.token}>
                    {selectedAuditReport.token}
                  </code>
                </div>
              </div>

              {/* Session Protection Status */}
              <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-800/70 flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                    Garantia de Não-Alteração (Sessões Travadas)
                  </p>
                  <p className="text-emerald-700/90 dark:text-emerald-400/90 mt-0.5">
                    {selectedAuditReport.status === 'approved'
                      ? 'As sessões contempladas neste relatório foram travadas no banco de dados contra edições ou exclusões pós-aprovação.'
                      : 'As sessões serão automaticamente bloqueadas contra modificações assim que o cliente aprovar o relatório.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Public Link Action Box */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
              <div className="flex items-center gap-2 truncate">
                <Globe className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="font-mono text-xs text-neutral-700 dark:text-neutral-300 truncate">
                  /shared/{selectedAuditReport.token}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyLink(selectedAuditReport.token, selectedAuditReport.id)}
                  className="h-8 gap-1.5 text-xs cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar URL</span>
                </Button>
                <Button
                  size="sm"
                  onClick={() => onOpenPublicShare(selectedAuditReport.token)}
                  className="h-8 gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir Relatório</span>
                </Button>
              </div>
            </div>
          </div>
        </Dialog>
      )}

      {/* REVOKE CONFIRMATION MODAL */}
      {reportToRevoke && (
        <Dialog
          open={Boolean(reportToRevoke)}
          onOpenChange={(open) => !open && setReportToRevoke(null)}
          title="Revogar Link de Compartilhamento?"
          description="Esta ação cancelará permanentemente o acesso público a este relatório."
          className="max-w-md"
        >
          <div className="space-y-4 pt-2">
            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs text-rose-800 dark:text-rose-300 space-y-1">
              <p className="font-semibold">Atenção:</p>
              <p>
                Clientes que tentarem acessar a URL compartilhada receberão uma mensagem informando que o relatório não está mais disponível.
              </p>
              <p className="font-mono text-[11px] mt-1 pt-1 border-t border-rose-200 dark:border-rose-900/50">
                Relatório: {reportToRevoke.title}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setReportToRevoke(null)}
                disabled={revoking}
                className="cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleRevokeReport}
                disabled={revoking}
                className="gap-1.5 cursor-pointer"
              >
                {revoking ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Confirmar Revogação</span>
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
