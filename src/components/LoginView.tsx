import React, { useState, useEffect } from 'react';
import { LogIn, UserPlus, Clock, KeyRound, ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react';
import { User, Tenant } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useToast } from './ui/toast';
import { apiFetch } from '../utils/api';

interface LoginViewProps {
  onLoginSuccess: (user: User, tenant: Tenant, hasLinkedClients?: boolean) => void;
}

export function LoginView({ onLoginSuccess }: LoginViewProps) {
  const { addToast } = useToast();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [hourlyRate, setHourlyRate] = useState('150');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tokenFromUrl = params.get('reset_token') || params.get('resetToken');
      if (tokenFromUrl) {
        setResetToken(tokenFromUrl);
        setMode('reset');
      }
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    try {
      setLoading(true);
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Credenciais inválidas');
      }

      if (data.token) {
        localStorage.setItem('jwt_token', data.token);
      }

      onLoginSuccess(data.user, data.tenant, Boolean(data.has_linked_clients));
      addToast({
        title: 'Login efetuado com sucesso!',
        description: `Bem-vindo de volta, ${data.user.name}.`,
        variant: 'success',
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao realizar login');
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
    setErrorMessage(null);
    try {
      setLoading(true);
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          tenant_name: tenantName || `Workspace de ${name.split(' ')[0]}`,
          default_hourly_rate: Number(hourlyRate) || 150,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Falha ao cadastrar');
      }

      if (data.token) {
        localStorage.setItem('jwt_token', data.token);
      }

      onLoginSuccess(data.user, data.tenant, Boolean(data.has_linked_clients));
      if (data.has_linked_clients) {
        addToast({
          title: 'Vínculos de cliente localizados!',
          description: `Seu e-mail está cadastrado como cliente em outros workspaces. Uma nova área de visualização foi disponibilizada.`,
          variant: 'default',
        });
      } else {
        addToast({
          title: 'Conta criada com sucesso!',
          description: `Workspace isolado ${data.tenant?.name} pronto para uso.`,
          variant: 'success',
        });
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro no cadastro');
      addToast({
        title: 'Erro no cadastro',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setDevResetUrl(null);
    try {
      setLoading(true);
      const res = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao solicitar recuperação');
      }

      setSuccessMessage(data.message || 'Instruções enviadas para seu e-mail.');
      if (data.preview_reset_url) {
        setDevResetUrl(data.preview_reset_url);
      }
      addToast({
        title: 'Recuperação enviada',
        description: 'Se o e-mail existir, você receberá o link de redefinição.',
        variant: 'success',
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao processar solicitação');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (newPassword.length < 6) {
      setErrorMessage('A nova senha deve ter no mínimo 6 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('As senhas não coincidem');
      return;
    }

    try {
      setLoading(true);
      const res = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: resetToken.trim(),
          new_password: newPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao redefinir senha');
      }

      addToast({
        title: 'Senha redefinida!',
        description: 'Sua senha foi alterada com sucesso. Faça login.',
        variant: 'success',
      });
      setMode('login');
      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setResetToken('');
      setSuccessMessage('Senha alterada com sucesso! Você já pode entrar com sua nova senha.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao redefinir senha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-950 p-4 sm:p-6 transition-colors">
      <div className="w-full max-w-md space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20">
            <Clock className="h-7 w-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Time Tracking & Faturamento
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Controle de horas, cálculo financeiro e workspaces multitenant
          </p>
        </div>

        {/* Card Box */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xl overflow-hidden p-6 sm:p-8 space-y-6">
          {/* Mode Switcher Tabs (Only shown for login & register) */}
          {(mode === 'login' || mode === 'register') && (
            <div className="grid grid-cols-2 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  mode === 'login'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Entrar</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  mode === 'register'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Criar Conta</span>
              </button>
            </div>
          )}

          {/* Success Message Box */}
          {successMessage && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-lg text-xs text-emerald-700 dark:text-emerald-300 space-y-2">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{successMessage}</span>
              </div>
              {devResetUrl && (
                <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-800/60">
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mb-1">
                    Modo desenvolvimento (link direto do email gerado):
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const match = devResetUrl.match(/reset_token=([^&]+)/);
                      if (match && match[1]) {
                        setResetToken(match[1]);
                        setMode('reset');
                      }
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 dark:text-emerald-200 underline cursor-pointer hover:opacity-80"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    Abrir formulário com token preenchido
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Error Message Box */}
          {errorMessage && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-lg text-xs text-red-600 dark:text-red-400 font-medium">
              {errorMessage}
            </div>
          )}

          {/* Login Form */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Email
                </label>
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="text-sm h-10"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Senha
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="text-sm h-10"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm cursor-pointer shadow-md shadow-indigo-600/10"
              >
                {loading ? 'Validando token...' : 'Entrar no Sistema'}
              </Button>
            </form>
          )}

          {/* Register Form */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Nome Completo
                </label>
                <Input
                  placeholder="Ex: Thiago Pascotto"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-sm h-9"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Email
                </label>
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="text-sm h-9"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Senha
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="text-sm h-9"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Nome do Workspace
                  </label>
                  <Input
                    placeholder="Ex: Minha Empresa"
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    className="text-sm h-9"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Valor/Hora Padrão (R$)
                  </label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="150"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    className="text-sm h-9"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm cursor-pointer shadow-md shadow-indigo-600/10 mt-2"
              >
                {loading ? 'Criando conta...' : 'Cadastrar e Acessar'}
              </Button>
            </form>
          )}

          {/* Forgot Password Form */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                    Recuperação de Senha
                  </h3>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Informe o e-mail cadastrado para receber as instruções e o token de redefinição de senha.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Email
                </label>
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="text-sm h-10"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm cursor-pointer shadow-md shadow-indigo-600/10"
              >
                {loading ? 'Enviando email...' : 'Enviar Instruções de Recuperação'}
              </Button>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMessage(null);
                  }}
                  className="inline-flex items-center gap-1 text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Voltar ao Login
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode('reset');
                    setErrorMessage(null);
                  }}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  Já tenho um token
                </button>
              </div>
            </form>
          )}

          {/* Reset Password Form */}
          {mode === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                    Criar Nova Senha
                  </h3>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Cole o token recebido por e-mail e defina sua nova senha de acesso.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Token de Redefinição
                </label>
                <Input
                  type="text"
                  placeholder="Token de 64 caracteres"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  className="text-xs font-mono h-9"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Nova Senha (mínimo 6 caracteres)
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="text-sm h-9"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Confirmar Nova Senha
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="text-sm h-9"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm cursor-pointer shadow-md shadow-indigo-600/10"
              >
                {loading ? 'Salvando...' : 'Salvar Nova Senha'}
              </Button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMessage(null);
                  }}
                  className="inline-flex items-center gap-1 text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Voltar ao Login
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
