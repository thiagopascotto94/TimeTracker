import React, { useState } from 'react';
import { LogIn, UserPlus, LogOut, CheckCircle2, Building2 } from 'lucide-react';
import { User, Tenant, TimeSession } from '../types';
import { Dialog } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useToast } from './ui/toast';
import { apiFetch } from '../utils/api';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: User | null;
  currentTenant: Tenant | null;
  activeSession?: TimeSession | null;
  onLoginSuccess: (user: User, tenant: Tenant) => void;
  onLogoutSuccess: () => void;
}

export function AuthModal({
  open,
  onOpenChange,
  currentUser,
  currentTenant,
  activeSession,
  onLoginSuccess,
  onLogoutSuccess,
}: AuthModalProps) {
  const { addToast } = useToast();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [hourlyRate, setHourlyRate] = useState('150');
  const [loading, setLoading] = useState(false);
  const [confirmLogoutActive, setConfirmLogoutActive] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Credenciais inválidas');
      }

      const data = await res.json();
      if (data.token) {
        localStorage.setItem('jwt_token', data.token);
      }
      onLoginSuccess(data.user, data.tenant);
      onOpenChange(false);
      setConfirmLogoutActive(false);
      addToast({
        title: 'Login efetuado com sucesso!',
        description: `Bem-vindo de volta, ${data.user.name}.`,
        variant: 'success',
      });
    } catch (err: any) {
      addToast({
        title: 'Erro de autenticação',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          tenant_name: tenantName,
          default_hourly_rate: Number(hourlyRate) || 150,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Falha ao cadastrar');
      }

      const data = await res.json();
      if (data.token) {
        localStorage.setItem('jwt_token', data.token);
      }
      onLoginSuccess(data.user, data.tenant);
      onOpenChange(false);
      setConfirmLogoutActive(false);
      addToast({
        title: 'Conta criada!',
        description: `Novo workspace isolado ${data.tenant.name} criado.`,
        variant: 'success',
      });
    } catch (err: any) {
      addToast({
        title: 'Erro no cadastro',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutClick = () => {
    if (activeSession) {
      setConfirmLogoutActive(true);
    } else {
      executeLogout();
    }
  };

  const executeLogout = async () => {
    try {
      setLoading(true);
      await apiFetch('/api/auth/logout', { method: 'POST' });
      localStorage.removeItem('jwt_token');
      onLogoutSuccess();
      onOpenChange(false);
      setConfirmLogoutActive(false);
      addToast({
        title: 'Sessão encerrada',
        description: 'Você saiu da sua conta com sucesso.',
        variant: 'default',
      });
    } catch (err: any) {
      console.error(err);
      addToast({
        title: 'Erro ao sair',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        currentUser
          ? 'Gerenciar Conta & Sessão'
          : mode === 'login'
          ? 'Entrar no Sistema'
          : 'Novo Cadastro (Multitenant)'
      }
      description={
        currentUser
          ? 'Visualize seus dados ativos ou encerre a sessão.'
          : 'Acesse seu workspace isolado de rastreamento de tempo.'
      }
    >
      <div className="space-y-4 pt-2">
        {currentUser ? (
          <div className="space-y-4">
            <div style={{ backgroundColor: '#e2e2e2' }} className="rounded-lg border border-neutral-200 dark:border-neutral-750 p-4 space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-bold">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 style={{ color: '#000000' }} className="text-sm font-semibold">{currentUser.name}</h4>
                  <p style={{ color: '#000000' }} className="text-xs">{currentUser.email}</p>
                </div>
              </div>

              {currentTenant && (
                <div className="pt-2 border-t border-neutral-200/60 dark:border-neutral-750 flex items-center justify-between text-xs">
                  <span style={{ color: '#000000' }} className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <strong>Workspace:</strong> {currentTenant.name}
                  </span>
                  <span style={{ color: '#000000' }} className="font-mono text-2xs">
                    {currentTenant.id}
                  </span>
                </div>
              )}
            </div>

            {confirmLogoutActive ? (
              <div className="space-y-4 p-4 border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 rounded-lg">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold text-sm">
                  <span>⚠️ Atenção: Cronômetro em Andamento!</span>
                </div>
                <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">
                  Existe uma sessão de cronômetro ativa (<strong className="text-neutral-900 dark:text-neutral-100">{activeSession?.title}</strong>). Se você realizar o logoff agora, a sessão em andamento será perdida/interrompida. Deseja realmente sair?
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setConfirmLogoutActive(false)}
                    className="text-xs"
                    disabled={loading}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={executeLogout}
                    disabled={loading}
                    className="text-xs gap-1.5"
                  >
                    <span>{loading ? 'Saindo...' : 'Sim, Sair e Perder Timer'}</span>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="text-xs"
                >
                  Fechar
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleLogoutClick}
                  className="text-xs gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Encerrar Sessão</span>
                </Button>
              </div>
            )}
          </div>
        ) : mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Email</label>
              <Input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-sm"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Senha</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="text-sm"
                required
              />
            </div>

            {/* Quick demo credentials hint */}
            <div className="rounded-md bg-neutral-100 dark:bg-neutral-850 p-2.5 text-2xs text-neutral-600 dark:text-neutral-300 border border-neutral-200/60 dark:border-neutral-750">
              💡 <strong>Conta Padrão Pré-cadastrada:</strong> thiagopascotto94@gmail.com / admin123
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setMode('register')}
                className="text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 underline cursor-pointer"
              >
                Criar novo espaço (Tenant)
              </button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs gap-1.5 cursor-pointer hover:bg-neutral-800 dark:hover:bg-neutral-200"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{loading ? 'Entrando...' : 'Entrar'}</span>
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Nome Completo</label>
              <Input
                placeholder="Ex: Ana Silva"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-sm"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Nome do Workspace</label>
              <Input
                placeholder="Ex: Studio Criativo"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                className="text-sm"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Taxa Horária Padrão (R$)</label>
              <Input
                type="number"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                className="text-sm"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Email</label>
              <Input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-sm"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Senha</label>
              <Input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="text-sm"
                required
              />
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 underline cursor-pointer"
              >
                Já possuo conta
              </button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs gap-1.5 cursor-pointer hover:bg-neutral-800 dark:hover:bg-neutral-200"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{loading ? 'Cadastrando...' : 'Cadastrar Workspace'}</span>
              </Button>
            </div>
          </form>
        )}
      </div>
    </Dialog>
  );
}
