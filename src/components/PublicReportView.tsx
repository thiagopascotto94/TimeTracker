import React, { useState, useEffect } from 'react';
import {
  Clock,
  DollarSign,
  Calendar,
  CheckCircle2,
  Building2,
  Share2,
  Printer,
  Copy,
  Check,
  ArrowLeft,
  AlertCircle,
  FileCheck,
  Briefcase,
  KeyRound,
  Lock,
  Mail,
  UserCheck,
  ShieldAlert,
  ShieldCheck,
  Eye,
  EyeOff,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { PublicSharedReport } from '../types';
import {
  formatCurrency,
  formatDateTime,
  formatDurationHuman,
} from '../utils/format';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
import { apiFetch } from '../utils/api';
import { Input } from './ui/input';

interface PublicReportViewProps {
  token: string;
  onBackToApp?: () => void;
}

export function PublicReportView({ token, onBackToApp }: PublicReportViewProps) {
  const [data, setData] = useState<PublicSharedReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Observation expansion states (only displayed when clicked on the badge)
  const [expandedTaskNotes, setExpandedTaskNotes] = useState<Record<string, boolean>>({});
  const [expandedSessionNotes, setExpandedSessionNotes] = useState<Record<string, boolean>>({});

  const toggleTaskNote = (taskId: string) => {
    setExpandedTaskNotes((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const toggleSessionNote = (sessionId: string) => {
    setExpandedSessionNotes((prev) => ({ ...prev, [sessionId]: !prev[sessionId] }));
  };

  // Review / Approval state
  const [reviewModalOpen, setReviewModalOpen] = useState<boolean>(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [authMethod, setAuthMethod] = useState<'contact' | 'code'>('contact');

  // Contact credentials
  const [contactEmail, setContactEmail] = useState<string>('');
  const [contactPassword, setContactPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // First access new password state
  const [mustChangePasswordStep, setMustChangePasswordStep] = useState<boolean>(false);
  const [contactInfoName, setContactInfoName] = useState<string>('');
  const [contactNewPassword, setContactNewPassword] = useState<string>('');
  const [contactConfirmPassword, setContactConfirmPassword] = useState<string>('');
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);

  // Legacy approval code
  const [approverName, setApproverName] = useState<string>('');
  const [approvalCodeInput, setApprovalCodeInput] = useState<string>('');

  const [reviewLoading, setReviewLoading] = useState<boolean>(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccessMessage, setReviewSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadShared() {
      try {
        setLoading(true);
        setError(null);
        const res = await apiFetch(`/api/public/shared/${token}`);
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || 'Relatório não encontrado ou token inválido.');
        }
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadShared();
  }, [token]);

  const copyCurrentLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleOpenReview = (action: 'approve' | 'reject') => {
    setReviewAction(action);
    setReviewError(null);
    setReviewSuccessMessage(null);
    setMustChangePasswordStep(false);
    setContactPassword('');
    setContactNewPassword('');
    setContactConfirmPassword('');
    setReviewModalOpen(true);
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewError(null);

    // 1. Flow via Contact credentials (Default & requested)
    if (authMethod === 'contact') {
      if (!contactEmail.trim()) {
        setReviewError('Informe seu e-mail cadastrado como contato.');
        return;
      }
      if (!contactPassword) {
        setReviewError('Informe sua senha de acesso.');
        return;
      }

      // If user is already on the first-access new password step
      if (mustChangePasswordStep) {
        if (!contactNewPassword.trim()) {
          setReviewError('Defina sua nova senha pessoal permanente.');
          return;
        }
        if (contactNewPassword.trim().length < 6) {
          setReviewError('A nova senha deve possuir no mínimo 6 caracteres.');
          return;
        }
        if (contactNewPassword !== contactConfirmPassword) {
          setReviewError('A confirmação da nova senha não confere.');
          return;
        }
        if (contactNewPassword === contactPassword) {
          setReviewError('A nova senha deve ser diferente da senha temporária inicial.');
          return;
        }
      }

      try {
        setReviewLoading(true);
        const payload: any = {
          action: reviewAction,
          email: contactEmail.trim().toLowerCase(),
          password: contactPassword,
        };

        if (mustChangePasswordStep) {
          payload.new_password = contactNewPassword.trim();
        }

        const res = await apiFetch(`/api/public/shared/${token}/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Falha ao processar aprovação.');

        // If contact needs to change password on first access
        if (json.requires_new_password) {
          setMustChangePasswordStep(true);
          setContactInfoName(json.contact_name || '');
          setReviewLoading(false);
          return;
        }

        // Successfully approved / reviewed
        setData((prev) => prev ? {
          ...prev,
          approval_status: json.status,
          approved_by: json.approved_by,
          approved_at: json.approved_at,
          approval_ip: json.approval_ip,
        } : null);

        setReviewSuccessMessage(
          json.password_changed_on_login
            ? 'Nova senha permanente cadastrada com sucesso e relatório aprovado!'
            : 'Relatório avaliado com sucesso!'
        );

        setTimeout(() => {
          setReviewModalOpen(false);
          setReviewSuccessMessage(null);
          setMustChangePasswordStep(false);
          setContactPassword('');
          setContactNewPassword('');
          setContactConfirmPassword('');
        }, 1800);
      } catch (err: any) {
        setReviewError(err.message);
      } finally {
        setReviewLoading(false);
      }
      return;
    }

    // 2. Legacy fallback via Approval Code
    if (!approverName.trim()) {
      setReviewError('Informe o seu nome.');
      return;
    }
    if (!approvalCodeInput.trim()) {
      setReviewError('Informe o código de aprovação.');
      return;
    }

    try {
      setReviewLoading(true);
      setReviewError(null);

      const res = await apiFetch(`/api/public/shared/${token}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: reviewAction,
          approval_code: approvalCodeInput.trim(),
          approver_name: approverName.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falha ao processar aprovação');

      setData((prev) => prev ? {
        ...prev,
        approval_status: json.status,
        approved_by: json.approved_by,
        approved_at: json.approved_at,
        approval_ip: json.approval_ip,
      } : null);

      setReviewModalOpen(false);
      setApprovalCodeInput('');
    } catch (err: any) {
      setReviewError(err.message);
    } finally {
      setReviewLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-neutral-900 dark:border-neutral-100 border-r-transparent" />
          <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Carregando relatório público...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 text-center space-y-4 shadow-sm">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Relatório Indisponível</h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{error || 'Token de acesso inválido ou expirado.'}</p>
          {onBackToApp && (
            <Button onClick={onBackToApp} variant="outline" className="text-xs">
              Voltar ao Início
            </Button>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Bar for navigation / print */}
        <div className="flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            {onBackToApp && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onBackToApp}
                className="gap-1.5 text-xs text-neutral-600 dark:text-neutral-300 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar ao Sistema</span>
              </Button>
            )}
            <Badge variant="outline" className="bg-white dark:bg-neutral-900 text-xs gap-1 border-neutral-300 dark:border-neutral-700">
              <FileCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Visualização Pública (Read-Only)
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={copyCurrentLink}
              className="gap-1.5 text-xs bg-white dark:bg-neutral-900 cursor-pointer border-neutral-200 dark:border-neutral-750"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado' : 'Copiar Link'}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="gap-1.5 text-xs bg-white dark:bg-neutral-900 cursor-pointer border-neutral-200 dark:border-neutral-750"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir / PDF</span>
            </Button>
          </div>
        </div>

        {/* STATEMENT HEADER CARD */}
        <Card className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden">
          <div className="p-6 sm:p-8 border-b border-neutral-100 dark:border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                <Building2 className="w-4 h-4 text-neutral-400" />
                <span>{data.workspace}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                {data.title}
              </h1>
              <p className="text-xs text-neutral-400">
                Relatório gerado em {formatDateTime(data.generated_at)}
              </p>
            </div>

            {/* Total Billing Highlight */}
            {data.include_cost ? (
              <div className="bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-750 rounded-xl p-4 md:text-right shrink-0">
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block">
                  Valor Total a Faturar
                </span>
                <span className="text-2xl sm:text-3xl font-bold font-mono text-emerald-700 dark:text-emerald-400 block mt-0.5">
                  {formatCurrency(data.summary.totalBillableAmount)}
                </span>
                <span className="text-2xs text-neutral-500 dark:text-neutral-400 font-medium">
                  Soma exata calculada individualmente por sessão/cliente
                </span>
              </div>
            ) : (
              <div className="bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-750 rounded-xl p-4 md:text-right shrink-0">
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block">
                  Total de Horas Trabalhadas
                </span>
                <span className="text-2xl sm:text-3xl font-bold font-mono text-indigo-600 dark:text-indigo-400 block mt-0.5">
                  {data.summary.totalDecimalHours.toFixed(2)}h
                </span>
                <span className="text-2xs text-neutral-500 dark:text-neutral-400 font-medium">
                  {formatDurationHuman(data.summary.totalDurationMs)}
                </span>
              </div>
            )}
          </div>

          {/* APPROVAL & AUDIT WIDGET */}
          <div className="p-6 bg-neutral-50/80 dark:bg-neutral-850/80 border-b border-neutral-200 dark:border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                  Status de Aprovação do Relatório:
                </span>
                {data.approval_status === 'approved' && (
                  <Badge className="bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 font-bold">
                    Aprovado ✅
                  </Badge>
                )}
                {data.approval_status === 'rejected' && (
                  <Badge className="bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-700 font-bold">
                    Rejeitado ❌
                  </Badge>
                )}
                {data.approval_status === 'pending' && (
                  <Badge className="bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 font-bold">
                    Pendente de Aprovação ⏳
                  </Badge>
                )}
              </div>

              {data.approval_status === 'pending' ? (
                data.allow_approval ? (
                  <p className="text-xs text-neutral-600 dark:text-neutral-400">
                    Utilize o código de aprovação fornecido pelo emissor para aprovar ou rejeitar os apontamentos.
                  </p>
                ) : (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 italic">
                    Aprovação interativa desativada pelo emissor (somente leitura).
                  </p>
                )
              ) : (
                <div className="text-xs space-y-0.5 text-neutral-700 dark:text-neutral-300 pt-1">
                  <p>
                    <strong>Aprovador:</strong> {data.approved_by}
                  </p>
                  <p>
                    <strong>Data/Hora:</strong> {data.approved_at ? formatDateTime(data.approved_at) : 'N/D'}
                  </p>
                  <p>
                    <strong>IP de Auditoria:</strong> <code className="font-mono text-neutral-900 dark:text-neutral-100">{data.approval_ip || 'N/D'}</code>
                  </p>
                </div>
              )}
            </div>

            {data.approval_status === 'pending' && data.allow_approval && (
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  onClick={() => handleOpenReview('approve')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 cursor-pointer font-semibold shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Aprovar Relatório</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleOpenReview('reject')}
                  className="border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs gap-1.5 cursor-pointer font-semibold"
                >
                  <AlertCircle className="w-4 h-4" />
                  <span>Rejeitar</span>
                </Button>
              </div>
            )}
          </div>

          {/* Metric Highlights Grid */}
          <div className={`grid grid-cols-2 ${data.include_cost ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} divide-y sm:divide-y-0 sm:divide-x divide-neutral-100 dark:divide-neutral-800 bg-neutral-50/50 dark:bg-neutral-850/50 p-4 border-b border-neutral-200 dark:border-neutral-800 text-center`}>
            <div className="p-3">
              <span className="text-xs text-neutral-500 dark:text-neutral-400 block font-medium">Horas Trabalhadas</span>
              <span className="text-xl font-bold font-mono text-neutral-900 dark:text-neutral-100 mt-1 block">
                {data.summary.totalDecimalHours.toFixed(2)}h
              </span>
              <span className="text-xs text-neutral-400">
                ({formatDurationHuman(data.summary.totalDurationMs)})
              </span>
            </div>

            {data.include_cost && (
              <div className="p-3">
                <span className="text-xs text-neutral-500 dark:text-neutral-400 block font-medium">
                  {data.summary.hasMultipleRates ? 'Taxas Aplicadas' : 'Taxa por Hora'}
                </span>
                <span className="text-xl font-bold font-mono text-neutral-900 dark:text-neutral-100 mt-1 block">
                  {data.summary.hasMultipleRates ? 'Por Sessão' : formatCurrency(data.summary.hourlyRate)}
                </span>
                <span className="text-xs text-neutral-400">
                  {data.summary.hasMultipleRates ? 'Conforme cada cliente' : 'Base acordada'}
                </span>
              </div>
            )}

            <div className="p-3">
              <span className="text-xs text-neutral-500 dark:text-neutral-400 block font-medium">Sessões de Foco</span>
              <span className="text-xl font-bold font-mono text-neutral-900 dark:text-neutral-100 mt-1 block">
                {data.summary.totalSessionsCount}
              </span>
              <span className="text-xs text-neutral-400">Períodos registrados</span>
            </div>

            <div className="p-3">
              <span className="text-xs text-neutral-500 dark:text-neutral-400 block font-medium">Tarefas Concluídas</span>
              <span className="text-xl font-bold font-mono text-neutral-900 dark:text-neutral-100 mt-1 block">
                {data.summary.totalTasksCount}
              </span>
              <span className="text-xs text-neutral-400">Itens entregues</span>
            </div>
          </div>

          {/* Activities Table */}
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                Detalhamento de Atividades e Tarefas
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Registro cronológico transparente do tempo dedicado e tarefas entregues.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    <th className="pb-3 pr-4">Sessão &amp; Tarefas</th>
                    <th className="pb-3 px-4 text-center">Início / Fim</th>
                    <th className="pb-3 px-4 text-right">Duração</th>
                    {data.include_cost && <th className="pb-3 pl-4 text-right">Total</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {data.sessions.map((s) => (
                    <tr key={s.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-850/50 transition-colors">
                      {/* Session Name & Tasks list */}
                      <td className="py-4 pr-4 align-top">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
                            {s.title}
                          </span>
                          {s.client && (
                            <span className="inline-flex items-center gap-1 text-2xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                              <Briefcase className="w-2.5 h-2.5" />
                              {s.client.name}
                            </span>
                          )}
                        </div>

                        {/* Session Observation Badge (RF: Click-to-view observation) */}
                        {s.notes && (
                          <div className="mt-1.5">
                            <button
                              type="button"
                              onClick={() => toggleSessionNote(s.id)}
                              className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer"
                              title="Clique para exibir ou ocultar as observações da sessão de cronômetro"
                            >
                              <FileText className="w-2.5 h-2.5 text-indigo-600 dark:text-indigo-400" />
                              <span>Observação da Sessão</span>
                            </button>
                            {expandedSessionNotes[s.id] && (
                              <div className="mt-1.5 p-2.5 rounded-md bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-800/50 text-xs text-indigo-950 dark:text-indigo-200 whitespace-pre-wrap leading-relaxed shadow-2xs">
                                <span className="font-semibold text-2xs text-indigo-800 dark:text-indigo-300 block mb-0.5 uppercase tracking-wide">
                                  Observações da sessão de cronômetro:
                                </span>
                                {s.notes}
                              </div>
                            )}
                          </div>
                        )}

                        {s.tasks && s.tasks.length > 0 ? (
                          <ul className="mt-2 space-y-2 pl-2 border-l-2 border-neutral-200 dark:border-neutral-750">
                            {s.tasks.map((t) => (
                              <li
                                key={t.id}
                                className="text-xs text-neutral-600 dark:text-neutral-300"
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
                                    {/* Task Observation Badge: only displayed if clicked upon */}
                                    {t.notes && (
                                      <button
                                        type="button"
                                        onClick={() => toggleTaskNote(t.id)}
                                        className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors cursor-pointer"
                                        title="Clique para exibir ou ocultar a observação desta tarefa"
                                      >
                                        <FileText className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                                        <span>Observação</span>
                                      </button>
                                    )}
                                  </div>
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
                        ) : (
                          <span className="text-xs text-neutral-400 italic block mt-1">
                            Sessão geral de desenvolvimento
                          </span>
                        )}
                      </td>

                      {/* Period */}
                      <td className="py-4 px-4 align-top text-center text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                        <div>{formatDateTime(s.start_time)}</div>
                        {s.end_time && (
                          <div className="text-neutral-400">até {formatDateTime(s.end_time)}</div>
                        )}
                      </td>

                      {/* Duration */}
                      <td className="py-4 px-4 align-top text-right whitespace-nowrap font-mono text-xs">
                        <span className="font-bold text-neutral-900 dark:text-neutral-100">
                          {s.metrics.decimalHours.toFixed(2)}h
                        </span>
                        <span className="text-neutral-400 block">
                          {formatDurationHuman(s.metrics.durationMs)}
                        </span>
                      </td>

                      {/* Billable Value */}
                      {data.include_cost && (
                        <td className="py-4 pl-4 align-top text-right whitespace-nowrap font-mono">
                          <div className="font-semibold text-emerald-700 dark:text-emerald-400 text-sm">
                            {formatCurrency(s.metrics.billableAmount)}
                          </div>
                          <div className="text-2xs text-neutral-400 font-normal">
                            @{formatCurrency(s.metrics.appliedHourlyRate ?? s.metrics.hourlyRate ?? (s.client?.hourly_rate ?? data.summary.hourlyRate))}/h
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer Summary in Statement */}
            <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 gap-2">
              <span>Extrato para conferência e prestação de contas • Valores calculados por sessão/cliente.</span>
              <div className="font-medium text-neutral-900 dark:text-neutral-100">
                {data.include_cost ? (
                  <>Total Geral (soma por sessão/cliente): <strong className="text-emerald-700 dark:text-emerald-400 text-base font-mono ml-1">{formatCurrency(data.summary.totalBillableAmount)}</strong></>
                ) : (
                  <>Total de Horas: <strong className="text-indigo-600 dark:text-indigo-400 text-base font-mono ml-1">{data.summary.totalDecimalHours.toFixed(2)}h</strong></>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* REVIEW / APPROVAL MODAL */}
      <Dialog
        open={reviewModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setReviewModalOpen(false);
            setMustChangePasswordStep(false);
            setReviewError(null);
          } else {
            setReviewModalOpen(true);
          }
        }}
        title={
          mustChangePasswordStep
            ? 'Primeiro Acesso — Cadastrar Nova Senha'
            : reviewAction === 'approve'
            ? 'Aprovar Relatório Compartilhado'
            : 'Rejeitar Relatório Compartilhado'
        }
        description={
          mustChangePasswordStep
            ? `Olá, ${contactInfoName || 'contato'}! Este é seu primeiro acesso com a senha temporária. Por segurança, cadastre sua nova senha permanente para concluir a aprovação.`
            : 'Faça login com seu e-mail de contato e senha para autenticar e registrar a aprovação.'
        }
      >
        <form onSubmit={handleReviewSubmit} className="space-y-4 pt-2">
          {reviewSuccessMessage && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{reviewSuccessMessage}</span>
            </div>
          )}

          {reviewError && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{reviewError}</span>
            </div>
          )}

          {/* FIRST ACCESS: SET PERMANENT NEW PASSWORD */}
          {mustChangePasswordStep ? (
            <div className="space-y-3.5 bg-amber-50/60 dark:bg-amber-950/30 p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/60">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span className="font-semibold text-xs">
                  Troca obrigatória da senha temporária
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  Nova Senha Permanente * (mínimo 6 caracteres)
                </label>
                <div className="relative">
                  <Input
                    type={showNewPassword ? 'text' : 'password'}
                    value={contactNewPassword}
                    onChange={(e) => setContactNewPassword(e.target.value)}
                    placeholder="Sua nova senha segura"
                    className="text-sm pr-9"
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  Confirmar Nova Senha *
                </label>
                <Input
                  type={showNewPassword ? 'text' : 'password'}
                  value={contactConfirmPassword}
                  onChange={(e) => setContactConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="text-sm"
                  required
                />
              </div>

              <p className="text-3xs text-neutral-500 dark:text-neutral-400">
                Esta senha passará a ser sua senha de acesso definitiva para futuras aprovações de relatórios deste cliente.
              </p>
            </div>
          ) : authMethod === 'contact' ? (
            /* STANDARD CONTACT LOGIN */
            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 flex items-center justify-between">
                  <span>E-mail do Contato (Usuário) *</span>
                </label>
                <div className="relative">
                  <Input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="seu.email@empresa.com"
                    className="text-sm pl-8"
                    required
                    autoFocus
                  />
                  <Mail className="w-4 h-4 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                    Senha de Acesso *
                  </label>
                  <span className="text-3xs text-neutral-400">
                    (Use a senha temporária recebida no 1º acesso)
                  </span>
                </div>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={contactPassword}
                    onChange={(e) => setContactPassword(e.target.value)}
                    placeholder="Sua senha temporária ou permanente"
                    className="text-sm pl-8 pr-9 font-mono"
                    required
                  />
                  <Lock className="w-4 h-4 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-1 flex items-center justify-between text-2xs text-neutral-500 dark:text-neutral-400">
                <button
                  type="button"
                  onClick={() => setAuthMethod('code')}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  Usar código de aprovação alfanumérico legado
                </button>
              </div>
            </div>
          ) : (
            /* LEGACY APPROVAL CODE FALLBACK */
            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  Seu Nome / Nome do Aprovador *
                </label>
                <Input
                  value={approverName}
                  onChange={(e) => setApproverName(e.target.value)}
                  placeholder="Ex: Carlos Silva (Gerente de Projetos)"
                  className="text-sm"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  Código de Aprovação Legado (Fornecido no Link) *
                </label>
                <Input
                  value={approvalCodeInput}
                  onChange={(e) => setApprovalCodeInput(e.target.value)}
                  placeholder="Ex: A3F8K2"
                  className="text-sm font-mono uppercase tracking-wider"
                  required
                />
              </div>

              <div className="pt-1 flex items-center justify-between text-2xs text-neutral-500 dark:text-neutral-400">
                <button
                  type="button"
                  onClick={() => setAuthMethod('contact')}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer font-medium"
                >
                  ← Voltar para login com E-mail e Senha do Contato
                </button>
              </div>
            </div>
          )}

          <div className="pt-2 flex justify-end gap-2 border-t border-neutral-100 dark:border-neutral-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setReviewModalOpen(false);
                setMustChangePasswordStep(false);
              }}
              className="text-xs cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={reviewLoading}
              className={`text-xs gap-1.5 text-white cursor-pointer ${
                reviewAction === 'approve'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {reviewLoading ? (
                'Processando...'
              ) : mustChangePasswordStep ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Salvar Nova Senha & {reviewAction === 'approve' ? 'Aprovar' : 'Rejeitar'}</span>
                </>
              ) : reviewAction === 'approve' ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Entrar & Aprovar Relatório</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Entrar & Rejeitar Relatório</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
