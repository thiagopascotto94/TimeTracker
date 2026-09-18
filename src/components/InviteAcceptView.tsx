import React, { useState, useEffect } from 'react';
import { UserCheck, Building2, Shield, ArrowRight, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { User, Tenant } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { useToast } from './ui/toast';
import { apiFetch } from '../utils/api';

interface InviteAcceptViewProps {
  token: string;
  onAccepted: (user: User, tenant: Tenant) => void;
  onCancel: () => void;
}

interface InviteDetails {
  valid: boolean;
  email: string;
  role: 'admin' | 'member';
  tenant_id: string;
  tenant_name: string;
  inviter_name: string;
  has_existing_account: boolean;
  expires_at: string;
}

export function InviteAcceptView({ token, onAccepted, onCancel }: InviteAcceptViewProps) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    async function validate() {
      try {
        setLoading(true);
        setError(null);
        const res = await apiFetch(`/api/invites/validate/${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.error || 'Convite inválido ou expirado');
        }

        setInvite(data);
      } catch (err: any) {
        setError(err.message || 'Erro ao validar convite');
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      validate();
    }
  }, [token]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite) return;

    if (!invite.has_existing_account) {
      if (!name.trim()) {
        setError('Por favor, informe seu nome completo');
        return;
      }
      if (password.length < 6) {
        setError('A senha deve ter pelo menos 6 caracteres');
        return;
      }
    }

    try {
      setSubmitting(true);
      setError(null);

      const res = await apiFetch(`/api/invites/${encodeURIComponent(token)}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || undefined,
          password: password || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao aceitar convite');
      }

      if (data.token) {
        localStorage.setItem('jwt_token', data.token);
      }

      addToast({
        title: 'Convite aceito com sucesso!',
        description: `Bem-vindo ao workspace ${data.tenant?.name}.`,
        variant: 'success',
      });

      onAccepted(data.user, data.tenant);
    } catch (err: any) {
      setError(err.message || 'Erro ao ingressar no workspace');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-950 p-6">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
            Validando seu convite de acesso...
          </p>
        </div>
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-950 p-4">
        <div className="w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-xl">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
            Convite Não Disponível
          </h2>
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            {error}
          </p>
          <Button
            onClick={onCancel}
            className="w-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-semibold h-10 cursor-pointer"
          >
            Ir para Tela de Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-950 p-4 sm:p-6 transition-colors">
      <div className="w-full max-w-md space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 mx-auto">
            <Sparkles className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Convite para Workspace
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Você foi convidado para colaborar no Cronos Time Tracker
          </p>
        </div>

        {/* Card Box */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xl overflow-hidden p-6 sm:p-8 space-y-6">
          {/* Workspace Invitation Badge */}
          <div className="bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs text-indigo-700 dark:text-indigo-300 font-semibold">
              <Building2 className="w-4 h-4" />
              <span>{invite?.tenant_name}</span>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-300">
              <strong className="text-neutral-900 dark:text-neutral-100">{invite?.inviter_name}</strong> convidou você para o workspace com a função:
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Badge variant="outline" className="bg-white dark:bg-neutral-800 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800">
                <Shield className="w-3 h-3 mr-1" />
                {invite?.role === 'admin' ? 'Administrador' : 'Membro da Equipe'}
              </Badge>
              <span className="text-2xs text-neutral-500 dark:text-neutral-400">
                Email: {invite?.email}
              </span>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-lg text-xs text-red-600 dark:text-red-400 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleAccept} className="space-y-4">
            {!invite?.has_existing_account ? (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Seu Nome Completo
                  </label>
                  <Input
                    placeholder="Ex: Ana Silva"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="text-sm h-10"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Crie uma Senha de Acesso
                  </label>
                  <Input
                    type="password"
                    placeholder="Mínimo de 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="text-sm h-10"
                    required
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-xs text-neutral-700 dark:text-neutral-300">
                  <span className="font-semibold">Conta existente identificada!</span> Você já possui cadastro com o e-mail <strong>{invite?.email}</strong>. Basta clicar abaixo para aceitar e vincular ao workspace.
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm cursor-pointer shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Ingressando no workspace...</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" />
                  <span>Aceitar Convite e Acessar</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 cursor-pointer"
            >
              Recusar ou Voltar para Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
