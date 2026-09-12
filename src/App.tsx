import React, { useState, useEffect, useCallback } from 'react';
import { Lock, LogIn, Sparkles } from 'lucide-react';
import { User, Tenant, TimeSession, TaskItem, Client } from './types';
import { ToastProvider, useToast } from './components/ui/toast';
import { Button } from './components/ui/button';
import { Navbar } from './components/Navbar';
import { TimerView } from './components/TimerView';
import { ReportsView } from './components/ReportsView';
import { HistoryView } from './components/HistoryView';
import { ClientsView } from './components/ClientsView';
import { SettingsView } from './components/SettingsView';
import { PublicReportView } from './components/PublicReportView';
import { AuthModal } from './components/AuthModal';
import { AiAssistantView } from './components/AiAssistantView';
import { formatCurrency, formatDurationHuman } from './utils/format';

function AppContent() {
  const { addToast } = useToast();

  // Public Read-Only Token detection (RF08 / RF6.3)
  const [publicToken, setPublicToken] = useState<string | null>(() => {
    // Check path /shared/:token
    const pathMatch = window.location.pathname.match(/\/shared\/([a-zA-Z0-9_-]+)/);
    if (pathMatch && pathMatch[1]) return pathMatch[1];

    // Check hash #/shared/:token or #shared/:token
    const hashMatch = window.location.hash.match(/shared\/([a-zA-Z0-9_-]+)/);
    if (hashMatch && hashMatch[1]) return hashMatch[1];

    // Check query param ?share=... or ?token=...
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('share') || urlParams.get('token');
    if (tokenParam) return tokenParam;

    return null;
  });

  // Main App State
  const [activeTab, setActiveTab] = useState<'timer' | 'reports' | 'history' | 'clients' | 'settings' | 'assistant'>('timer');
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [activeSession, setActiveSession] = useState<TimeSession | null>(null);
  const [sessions, setSessions] = useState<TimeSession[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [resumeSession, setResumeSession] = useState<TimeSession | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);

  // Dark / Light Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved === 'dark' || saved === 'light') return saved;
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Listen to popstate or hashchange
  useEffect(() => {
    const handleUrlChange = () => {
      const pathMatch = window.location.pathname.match(/\/shared\/([a-zA-Z0-9_-]+)/);
      const hashMatch = window.location.hash.match(/shared\/([a-zA-Z0-9_-]+)/);
      const urlParams = new URLSearchParams(window.location.search);
      const token = pathMatch?.[1] || hashMatch?.[1] || urlParams.get('share') || urlParams.get('token');
      setPublicToken(token || null);
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  // Fetch Current User & Tenant
  const fetchAuthUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setTenant(data.tenant);
      }
    } catch (err) {
      console.error('Error fetching user:', err);
    }
  }, []);

  // Fetch Active Session (RF03 / RF5.2)
  const fetchActiveSession = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions/active');
      if (res.ok) {
        const data = await res.json();
        setActiveSession(data.session);
      }
    } catch (err) {
      console.error('Error fetching active session:', err);
    }
  }, []);

  // Fetch All Sessions (RF06 & History)
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
    }
  }, []);

  // Fetch Clients
  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch('/api/clients');
      if (res.ok) {
        const data = await res.json();
        setClients(data.clients || []);
      }
    } catch (err) {
      console.error('Error fetching clients:', err);
    }
  }, []);

  // Initial Load
  useEffect(() => {
    async function init() {
      setLoading(true);
      await fetchAuthUser();
      await fetchActiveSession();
      await fetchSessions();
      await fetchClients();
      setLoading(false);
    }
    init();
  }, [fetchAuthUser, fetchActiveSession, fetchSessions, fetchClients]);

  // Handler: Start Session (RF03)
  const handleStartSession = async (data: {
    title: string;
    target_minutes: number | null;
    previous_session_id: string | null;
    client_id: string | null;
  }) => {
    try {
      setLoading(true);
      const res = await fetch('/api/sessions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Erro ao iniciar sessão');
      }

      const resData = await res.json();
      setActiveSession(resData.session);
      addToast({
        title: 'Cronômetro Iniciado',
        description: `Sessão "${resData.session.title}" em andamento com horário oficial do servidor.`,
        variant: 'success',
      });
      await fetchSessions();
    } catch (err: any) {
      addToast({
        title: 'Não foi possível iniciar',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handler: Stop Session (RF03)
  const handleStopSession = async (sessionId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/sessions/${sessionId}/stop`, {
        method: 'PUT',
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Erro ao finalizar sessão');
      }

      const resData = await res.json();
      const stoppedSession = resData.session;
      setActiveSession(null);

      // Compute total session billable value
      const durationMs =
        new Date(stoppedSession.end_time).getTime() -
        new Date(stoppedSession.start_time).getTime();
      const decimalHours = durationMs / 3600000;
      const rate = user?.default_hourly_rate || 150;
      const billable = decimalHours * rate;

      addToast({
        title: 'Sessão Finalizada!',
        description: `Duração: ${formatDurationHuman(durationMs)} (${decimalHours.toFixed(
          2
        )}h). Faturável: ${formatCurrency(billable)}.`,
        variant: 'success',
      });

      await fetchSessions();
    } catch (err: any) {
      addToast({
        title: 'Erro ao finalizar',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handler: Add Task in Real-Time (RF05)
  const handleAddTask = async (sessionId: string, description: string) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          time_session_id: sessionId,
          description,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Erro ao adicionar tarefa');
      }

      const resData = await res.json();
      const newTask: TaskItem = resData.task;

      // Update active session locally
      setActiveSession((prev) => {
        if (!prev) return null;
        const currentTasks = prev.Tasks || prev.tasks || [];
        return {
          ...prev,
          Tasks: [...currentTasks, newTask],
          tasks: [...currentTasks, newTask],
        };
      });

      addToast({
        title: 'Tarefa Registrada',
        description: description,
        variant: 'default',
      });
    } catch (err: any) {
      addToast({
        title: 'Erro ao salvar tarefa',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  // Handler: Delete Task (RF5.3)
  const handleDeleteTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Erro ao remover tarefa');

      setActiveSession((prev) => {
        if (!prev) return null;
        const currentTasks = prev.Tasks || prev.tasks || [];
        const filtered = currentTasks.filter((t) => t.id !== taskId);
        return {
          ...prev,
          Tasks: filtered,
          tasks: filtered,
        };
      });

      addToast({
        title: 'Tarefa removida',
        variant: 'default',
      });
    } catch (err: any) {
      addToast({
        title: 'Erro',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  // Handler: Delete Session
  const handleDeleteSession = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Erro ao excluir sessão');

      if (activeSession?.id === sessionId) {
        setActiveSession(null);
      }
      await fetchSessions();
      addToast({
        title: 'Sessão excluída',
        variant: 'default',
      });
    } catch (err: any) {
      addToast({
        title: 'Erro ao excluir',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  // Handler: Resume / Continue Session (RF06)
  const handleResumeSession = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId) || null;
    setResumeSession(session);
    setActiveTab('timer');
  };

  // Handler: Share single session
  const handleShareSession = async (sessionId: string) => {
    try {
      const res = await fetch('/api/reports/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          title: 'Relatório da Sessão de Trabalho',
        }),
      });
      if (!res.ok) throw new Error('Erro ao compartilhar sessão');
      const data = await res.json();
      setPublicToken(data.token);
      window.history.pushState(null, '', `/shared/${data.token}`);
    } catch (err: any) {
      addToast({
        title: 'Erro ao compartilhar',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  // Handler: Update User Profile & Hourly Rate (RF07 / Settings)
  const handleUpdateProfile = async (data: {
    name: string;
    default_hourly_rate: number;
    tenant_name: string;
  }) => {
    try {
      setLoading(true);
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Erro ao atualizar perfil');
      }

      const resData = await res.json();
      setUser(resData.user);
      if (resData.tenant) setTenant(resData.tenant);

      addToast({
        title: 'Configurações Salvas!',
        description: `Taxa horária atualizada para ${formatCurrency(
          data.default_hourly_rate
        )}/h.`,
        variant: 'success',
      });
    } catch (err: any) {
      addToast({
        title: 'Erro ao salvar',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Public View (RF6.3: Oculta Sidebar, Header de navegação e controles de Timer)
  if (publicToken) {
    return (
      <PublicReportView
        token={publicToken}
        onBackToApp={() => {
          setPublicToken(null);
          window.history.pushState(null, '', '/');
        }}
      />
    );
  }

  const hourlyRate = user?.default_hourly_rate || 150.0;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col font-sans transition-colors">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        tenant={tenant}
        activeSession={activeSession}
        onOpenAuth={() => setAuthModalOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col items-center justify-center">
        {!user && !loading ? (
          <div className="max-w-md w-full mx-auto my-12 p-8 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm text-center space-y-6">
            <div className="w-14 h-14 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto text-neutral-800 dark:text-neutral-200">
              <Lock className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                Sessão Encerrada / Autenticação Necessária
              </h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Para acessar o cronômetro, relatórios, histórico e configurações do seu workspace multitenant, faça login na sua conta.
              </p>
            </div>
            <Button
              onClick={() => setAuthModalOpen(true)}
              className="w-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 font-semibold py-2.5 cursor-pointer shadow-sm"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Entrar ou Criar Conta
            </Button>
          </div>
        ) : loading ? (
          <div className="text-center py-20 text-neutral-500">Carregando dados da sessão...</div>
        ) : (
          <div className="w-full space-y-6">
            {activeTab === 'timer' && (
              <TimerView
                activeSession={activeSession}
                clients={clients}
                hourlyRate={hourlyRate}
                resumeSession={resumeSession}
                onClearResumeSession={() => setResumeSession(null)}
                onStartSession={handleStartSession}
                onStopSession={handleStopSession}
                onAddTask={handleAddTask}
                onDeleteTask={handleDeleteTask}
                loading={loading}
              />
            )}

            {activeTab === 'reports' && (
              <ReportsView
                hourlyRate={hourlyRate}
                clients={clients}
                onOpenPublicShare={(token) => {
                  setPublicToken(token);
                  window.history.pushState(null, '', `/shared/${token}`);
                }}
              />
            )}

            {activeTab === 'history' && (
              <HistoryView
                sessions={sessions}
                hourlyRate={hourlyRate}
                clients={clients}
                onResumeSession={handleResumeSession}
                onDeleteSession={handleDeleteSession}
                onShareSession={handleShareSession}
                loading={loading}
              />
            )}

            {activeTab === 'clients' && (
              <ClientsView
                clients={clients}
                onRefreshClients={fetchClients}
                defaultHourlyRate={hourlyRate}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                user={user}
                tenant={tenant}
                onUpdateProfile={handleUpdateProfile}
                loading={loading}
              />
            )}

            {activeTab === 'assistant' && (
              <AiAssistantView
                user={user}
                tenant={tenant}
                activeSession={activeSession}
                onRefreshData={async () => {
                  await fetchActiveSession();
                  await fetchSessions();
                  await fetchClients();
                }}
                onNavigateToTimer={() => setActiveTab('timer')}
              />
            )}
          </div>
        )}
      </main>

      {/* Floating Quick AI Button (when not on assistant tab) */}
      {user && activeTab !== 'assistant' && !publicToken && (
        <button
          onClick={() => setActiveTab('assistant')}
          className="fixed bottom-20 md:bottom-6 right-6 z-30 flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-lg hover:shadow-xl transition-all cursor-pointer hover:scale-105 active:scale-95"
          title="Abrir Assistente Cronos AI (Gemini 60 steps)"
        >
          <Sparkles className="w-4 h-4" />
          <span className="hidden sm:inline">Cronos AI</span>
          <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">IA</span>
        </button>
      )}

      {/* Footer */}
      <footer className="border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 py-6 text-center text-xs text-neutral-500 dark:text-neutral-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>
            Time Tracking &amp; Faturamento • Sistema Multitenant com SQLite e Sequelize
          </p>
          <p className="text-neutral-400 dark:text-neutral-500">
            {tenant ? `Workspace: ${tenant.name}` : 'Ambiente Local'}
          </p>
        </div>
      </footer>

      {/* Auth / Account Switcher Modal */}
      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        currentUser={user}
        currentTenant={tenant}
        activeSession={activeSession}
        onLoginSuccess={(u, t) => {
          setUser(u);
          setTenant(t);
          fetchActiveSession();
          fetchSessions();
        }}
        onLogoutSuccess={() => {
          setUser(null);
          setTenant(null);
          setActiveSession(null);
          setSessions([]);
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
