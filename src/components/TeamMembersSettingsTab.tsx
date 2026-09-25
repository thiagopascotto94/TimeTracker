import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  ShieldAlert,
  Clock,
  Trash2,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { useToast } from './ui/toast';
import { apiFetch } from '../utils/api';
import { User, Tenant } from '../types';

interface MemberItem {
  id: string;
  name: string;
  email: string;
  role: string;
  default_hourly_rate: number;
  can_view_billing?: boolean;
  weekly_target_hours?: number | null;
  created_at: string;
}

interface InviteItem {
  id: string;
  email: string;
  role: 'admin' | 'member';
  can_view_billing?: boolean;
  status: 'pending' | 'accepted' | 'expired' | 'canceled';
  token: string;
  expires_at: string;
  created_at: string;
  Inviter?: {
    name: string;
    email: string;
  };
}

interface TeamMembersSettingsTabProps {
  currentUser: User | null;
  tenant: Tenant | null;
  onNavigateToBilling?: () => void;
}

export function TeamMembersSettingsTab({
  currentUser,
  tenant,
  onNavigateToBilling,
}: TeamMembersSettingsTabProps) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [planLimits, setPlanLimits] = useState<{
    current_users: number;
    max_users: number;
    limit_reached: boolean;
    plan_name: string;
    plan_id: string;
  } | null>(null);

  // Modal / Form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');
  const [inviteCanViewBilling, setInviteCanViewBilling] = useState(true);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [invitesRes, billingRes] = await Promise.all([
        apiFetch('/api/invites'),
        apiFetch('/api/billing/status'),
      ]);

      if (invitesRes.ok) {
        const data = await invitesRes.json();
        setMembers(data.members || []);
        setInvites(data.invites || []);
      }

      if (billingRes.ok) {
        const billingData = await billingRes.json();
        const usersUsage = billingData.usage?.users;
        const currentUsers = typeof usersUsage === 'object' && usersUsage !== null
          ? Number(usersUsage.current ?? 1)
          : Number(usersUsage ?? 1);
        const maxUsers = typeof usersUsage === 'object' && usersUsage !== null
          ? (usersUsage.unlimited ? 99999 : Number(usersUsage.max ?? 1))
          : Number(billingData.limits?.max_users ?? billingData.plan?.max_users ?? 1);
        const isUnlimited = typeof usersUsage === 'object' && usersUsage !== null ? !!usersUsage.unlimited : maxUsers >= 9999;
        const limitReached = !isUnlimited && currentUsers >= maxUsers;

        setPlanLimits({
          current_users: currentUsers,
          max_users: maxUsers,
          limit_reached: limitReached,
          plan_name: billingData.plan?.name || 'Free',
          plan_id: billingData.plan?.id || 'free',
        });
      }
    } catch (err: any) {
      console.error('Failed to load team data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!inviteEmail.trim()) {
      setFormError('Informe um e-mail válido');
      return;
    }

    try {
      setSendingInvite(true);
      const res = await apiFetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim().toLowerCase(),
          role: inviteRole,
          can_view_billing: inviteCanViewBilling,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao enviar convite');
      }

      addToast({
        title: 'Convite enviado!',
        description: `Convite enviado para ${inviteEmail}.`,
        variant: 'success',
      });

      setInviteEmail('');
      setInviteRole('member');
      setInviteCanViewBilling(true);
      fetchData();
    } catch (err: any) {
      setFormError(err.message || 'Erro ao enviar convite');
      addToast({
        title: 'Limite ou Erro no Convite',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSendingInvite(false);
    }
  };

  const handleToggleBilling = async (memberId: string, currentVal: boolean) => {
    const nextVal = !currentVal;
    try {
      setUpdatingMemberId(memberId);
      // Optimistic update
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, can_view_billing: nextVal } : m))
      );

      const res = await apiFetch(`/api/invites/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ can_view_billing: nextVal }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Falha ao atualizar permissões');
      }

      addToast({
        title: 'Permissão atualizada',
        description: nextVal
          ? 'O membro agora pode visualizar relatórios e valores de faturamento.'
          : 'O membro não tem mais acesso a valores e relatórios de faturamento.',
        variant: 'success',
      });
    } catch (err: any) {
      // Revert on error
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, can_view_billing: currentVal } : m))
      );
      addToast({
        title: 'Erro ao atualizar',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleUpdateTargets = async (memberId: string, weekly: number | null) => {
    try {
      setUpdatingMemberId(memberId);
      const activeWsId = localStorage.getItem('cronos_active_workspace_id') || tenant?.id;
      const res = await apiFetch(`/api/workspaces/${activeWsId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekly_target_hours: weekly }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Falha ao atualizar metas');
      }

      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, weekly_target_hours: weekly } : m))
      );

      addToast({
        title: 'Meta atualizada',
        description: 'A meta de horas semanais do membro foi salva com sucesso.',
        variant: 'success',
      });
    } catch (err: any) {
      addToast({
        title: 'Erro ao salvar meta',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      setCancelingId(inviteId);
      const res = await apiFetch(`/api/invites/${inviteId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao cancelar convite');
      }

      addToast({
        title: 'Convite cancelado',
        description: 'O link de acesso deste convite foi revogado.',
        variant: 'success',
      });

      fetchData();
    } catch (err: any) {
      addToast({
        title: 'Erro ao cancelar',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setCancelingId(null);
    }
  };

  const copyInviteLink = (token: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${origin}/?invite=${token}`;
    navigator.clipboard.writeText(link);
    setCopiedToken(token);
    addToast({
      title: 'Link copiado!',
      description: 'O link do convite foi copiado para a área de transferência.',
      variant: 'success',
    });
    setTimeout(() => setCopiedToken(null), 3000);
  };

  const pendingInvites = invites.filter((inv) => inv.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Header & Plan limits indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              Equipe &amp; Colaboradores
            </h3>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Gerencie quem tem acesso ao workspace <strong>{tenant?.name}</strong>.
          </p>
        </div>

        {planLimits && (
          <div className="flex items-center gap-3 bg-neutral-50 dark:bg-neutral-800/80 px-4 py-2.5 rounded-xl border border-neutral-200/80 dark:border-neutral-700/80">
            <div>
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Limite do Plano ({planLimits.plan_name})
              </div>
              <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                {planLimits.current_users} / {planLimits.max_users >= 9999 ? 'Ilimitado' : `${planLimits.max_users} usuários`}
              </div>
            </div>

            {planLimits.limit_reached && onNavigateToBilling && (
              <Button
                type="button"
                size="sm"
                onClick={onNavigateToBilling}
                className="h-7 text-2xs bg-amber-500 hover:bg-amber-600 text-white font-semibold cursor-pointer shadow-xs"
              >
                Fazer Upgrade
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Invite Member Box */}
      <Card className="border border-neutral-200 dark:border-neutral-800 shadow-2xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Convidar Novo Membro por E-mail</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Um e-mail de convite com link de adesão será disparado imediatamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {planLimits && planLimits.plan_id !== 'team' ? (
            <div className="p-4 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 rounded-xl space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-indigo-600 dark:text-indigo-400" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-indigo-900 dark:text-indigo-100">
                    {planLimits.plan_id === 'pro'
                      ? 'O Plano Pro é de uso estritamente individual (1 usuário).'
                      : 'Convites de equipe requerem o Plano Team.'}
                  </p>
                  <p className="text-2xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
                    {planLimits.plan_id === 'pro'
                      ? 'Seu plano Pro (R$ 4,99/mês) inclui todas as ferramentas avançadas, IA ilimitada e exportação de dados, porém não aceita novos membros. Para colaborar em equipe com múltiplos usuários e convites, faça upgrade para o plano Team (R$ 9,90 por usuário).'
                      : 'O envio de convites e gestão de múltiplos colaboradores no workspace está disponível exclusivamente no plano Team (R$ 9,90/mês por usuário).'}
                  </p>
                </div>
              </div>

              {onNavigateToBilling && (
                <div className="pt-1 flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={onNavigateToBilling}
                    className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer shadow-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    <span>Fazer Upgrade para Plano Team (R$ 9,90/usuário)</span>
                  </Button>
                </div>
              )}
            </div>
          ) : planLimits?.limit_reached ? (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-xl flex items-start gap-3 text-xs text-amber-800 dark:text-amber-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div className="space-y-1">
                <p className="font-semibold">Limite de usuários atingido para o plano {planLimits.plan_name}</p>
                <p className="text-2xs text-amber-700 dark:text-amber-300">
                  Cada usuário adicional no plano Team é faturado a R$ 9,90/mês.
                </p>
                {onNavigateToBilling && (
                  <button
                    type="button"
                    onClick={onNavigateToBilling}
                    className="inline-flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400 hover:underline pt-1 cursor-pointer"
                  >
                    Ver cobrança &rarr;
                  </button>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSendInvite} className="space-y-3">
              {formError && (
                <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-lg text-xs text-red-600 dark:text-red-400 font-medium">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-7">
                  <label className="text-2xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1 block">
                    E-mail do Colaborador
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                    <Input
                      type="email"
                      placeholder="colega@empresa.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="pl-9 text-xs h-9"
                      required
                    />
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <label className="text-2xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1 block">
                    Função de Acesso
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    className="w-full h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs px-2.5 text-neutral-900 dark:text-neutral-100"
                  >
                    <option value="member">Membro (Time Tracking)</option>
                    <option value="admin">Administrador (Total)</option>
                  </select>
                </div>

                <div className="sm:col-span-2 flex items-end">
                  <Button
                    type="submit"
                    disabled={sendingInvite}
                    className="w-full h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs cursor-pointer shadow-xs"
                  >
                    {sendingInvite ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      'Convidar'
                    )}
                  </Button>
                </div>
              </div>

              {/* Permission Checkbox for Billing */}
              <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <label
                  id="invite-billing-permission-label"
                  className="inline-flex items-center gap-2 cursor-pointer select-none"
                >
                  <input
                    id="invite-can-view-billing-checkbox"
                    type="checkbox"
                    checked={inviteCanViewBilling}
                    onChange={(e) => setInviteCanViewBilling(e.target.checked)}
                    className="w-4 h-4 rounded border-neutral-300 dark:border-neutral-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200">
                    Permitir visualização dos valores de faturamento
                  </span>
                </label>
                <span className="text-2xs text-neutral-500 dark:text-neutral-400">
                  Se desmarcado, o membro terá acesso apenas às horas trabalhadas e tarefas, sem dados monetários.
                </span>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Active Members Table */}
      <Card className="border border-neutral-200 dark:border-neutral-800 shadow-2xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Membros Ativos ({members.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
               <thead className="bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Nome &amp; E-mail</th>
                  <th className="px-4 py-2.5 font-semibold">Função</th>
                  <th className="px-4 py-2.5 font-semibold text-center">Ver Faturamento</th>
                  <th className="px-4 py-2.5 font-semibold">Taxa Padrão</th>
                  <th className="px-4 py-2.5 font-semibold text-center">Meta Semanal (h)</th>
                  <th className="px-4 py-2.5 font-semibold">Membro Desde</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0">
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                            <span>{m.name}</span>
                            {m.id === currentUser?.id && (
                              <Badge variant="outline" className="text-[9px] py-0 px-1 border-neutral-300 text-neutral-500">
                                Você
                              </Badge>
                            )}
                          </div>
                          <div className="text-2xs text-neutral-500 dark:text-neutral-400">
                            {m.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={
                          m.role === 'admin'
                            ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 text-2xs'
                            : 'bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 text-2xs'
                        }
                      >
                        {m.role === 'admin' ? 'Administrador' : 'Membro'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {m.id === currentUser?.id || m.role === 'admin' ? (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-2xs font-medium">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>{m.id === currentUser?.id ? 'Total (Você)' : 'Administrador'}</span>
                        </div>
                      ) : (
                        <label
                          id={`member-billing-toggle-${m.id}`}
                          className="inline-flex items-center gap-1.5 cursor-pointer select-none"
                          title={m.can_view_billing !== false ? 'Clique para ocultar valores' : 'Clique para liberar valores'}
                        >
                          <input
                            type="checkbox"
                            id={`checkbox-member-billing-${m.id}`}
                            checked={m.can_view_billing !== false}
                            disabled={updatingMemberId === m.id}
                            onChange={() => handleToggleBilling(m.id, m.can_view_billing !== false)}
                            className="w-4 h-4 rounded border-neutral-300 dark:border-neutral-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-50"
                          />
                          <span
                            className={`text-2xs font-semibold ${
                              m.can_view_billing !== false
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-neutral-500 dark:text-neutral-400'
                            }`}
                          >
                            {updatingMemberId === m.id ? (
                              <Loader2 className="w-3 h-3 animate-spin inline" />
                            ) : m.can_view_billing !== false ? (
                              'Liberado'
                            ) : (
                              'Oculto'
                            )}
                          </span>
                        </label>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300 font-mono">
                      R$ {Number(m.default_hourly_rate || 0).toFixed(2)}/h
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="number"
                        step="1"
                        min="0"
                        max="168"
                        placeholder="Ex: 40"
                        value={m.weekly_target_hours ?? ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? null : Number(e.target.value);
                          setMembers((prev) => prev.map((item) => (item.id === m.id ? { ...item, weekly_target_hours: val } : item)));
                        }}
                        onBlur={(e) => {
                          const val = e.target.value === '' ? null : Number(e.target.value);
                          handleUpdateTargets(m.id, val);
                        }}
                        className="w-20 px-2 py-1 text-xs text-center rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:ring-1 focus:ring-indigo-500"
                        title="Meta de horas semanais (ex: 40)"
                      />
                    </td>
                    <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400 text-2xs">
                      {new Date(m.created_at).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pending Invites Table */}
      {pendingInvites.length > 0 && (
        <Card className="border border-neutral-200 dark:border-neutral-800 shadow-2xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <span>Convites Pendentes ({pendingInvites.length})</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Pessoas que receberam convite mas ainda não concluíram o cadastro.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">E-mail Convidado</th>
                    <th className="px-4 py-2.5 font-semibold">Função</th>
                    <th className="px-4 py-2.5 font-semibold text-center">Ver Faturamento</th>
                    <th className="px-4 py-2.5 font-semibold">Expira em</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {pendingInvites.map((inv) => (
                    <tr key={inv.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30">
                      <td className="px-4 py-3 font-medium text-neutral-900 dark:text-neutral-100">
                        {inv.email}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-2xs">
                          {inv.role === 'admin' ? 'Administrador' : 'Membro'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant="outline"
                          className={`text-2xs ${
                            inv.can_view_billing !== false
                              ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700'
                          }`}
                        >
                          {inv.can_view_billing !== false ? 'Liberado' : 'Oculto'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400 text-2xs">
                        {new Date(inv.expires_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => copyInviteLink(inv.token)}
                            className="h-7 text-2xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 cursor-pointer"
                          >
                            {copiedToken === inv.token ? (
                              <>
                                <Check className="w-3 h-3 mr-1 text-emerald-600" />
                                Copiado
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 mr-1" />
                                Copiar Link
                              </>
                            )}
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={cancelingId === inv.id}
                            onClick={() => handleCancelInvite(inv.id)}
                            className="h-7 text-2xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 cursor-pointer"
                          >
                            {cancelingId === inv.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <>
                                <Trash2 className="w-3 h-3 mr-1" />
                                Revogar
                              </>
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
