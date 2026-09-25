import React, { useState, useEffect, useCallback } from 'react';
import { Lock, LogIn, Sparkles, UserCheck, ArrowRight } from 'lucide-react';
import { User, Tenant, TimeSession, TaskItem, Client, GitRepositoryItem, LinkedClientItem } from './types';
import { ToastProvider, useToast } from './components/ui/toast';
import { Button } from './components/ui/button';
import { Sidebar } from './components/Sidebar';
import { TimerView } from './components/TimerView';
import { ReportsView } from './components/ReportsView';
import { HistoryView } from './components/HistoryView';
import { ClientsView } from './components/ClientsView';
import { ClientFormView } from './components/ClientFormView';
import { ClientContactsView } from './components/ClientContactsView';
import { SettingsView } from './components/SettingsView';
import { PublicReportView } from './components/PublicReportView';
import { AuthModal } from './components/AuthModal';
import { LoginView } from './components/LoginView';
import { InviteAcceptView } from './components/InviteAcceptView';
import { AiAssistantView } from './components/AiAssistantView';
import { SessionEditView } from './components/SessionEditView';
import { LinkedClientsView } from './components/LinkedClientsView';
import { NotesView } from './components/NotesView';
import { TeamProgressView } from './components/TeamProgressView';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { ShortcutsHelpModal } from './components/ShortcutsHelpModal';
import { useDynamicDocumentTitle } from './hooks/useDynamicDocumentTitle';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { formatCurrency, formatDurationHuman } from './utils/format';
import { apiFetch } from './utils/api';

export type TabType = 'timer' | 'reports' | 'history' | 'clients' | 'client-new' | 'client-edit' | 'client-contacts' | 'session-edit' | 'notes' | 'settings' | 'assistant' | 'linked-clients' | 'team-progress';
const VALID_TABS: readonly TabType[] = ['timer', 'reports', 'history', 'clients', 'client-new', 'client-edit', 'client-contacts', 'session-edit', 'notes', 'settings', 'assistant', 'linked-clients', 'team-progress'] as const;

function getTabFromUrl(): { tab: TabType; clientId?: string; sessionId?: string; reportsSubTab?: 'overview' | 'shared-links' } {
  if (typeof window === 'undefined') return { tab: 'timer' };

  const path = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();

  if (path === 'reports/approved' || path === 'reports/shared' || path === 'reports/links') {
    return { tab: 'reports', reportsSubTab: 'shared-links' };
  }
  if (path === 'clients/new' || path === 'client/new') {
    return { tab: 'client-new' };
  }
  if (path === 'linked-clients' || path === 'vinculos' || path === 'meus-vinculos') {
    return { tab: 'linked-clients' };
  }
  const editMatch = path.match(/^clients\/edit\/([a-zA-Z0-9_-]+)$/) || path.match(/^client\/([a-zA-Z0-9_-]+)\/edit$/);
  if (editMatch && editMatch[1]) {
    return { tab: 'client-edit', clientId: editMatch[1] };
  }
  const contactsMatch = path.match(/^clients\/contacts\/([a-zA-Z0-9_-]+)$/) || path.match(/^client\/([a-zA-Z0-9_-]+)\/contacts$/);
  if (contactsMatch && contactsMatch[1]) {
    return { tab: 'client-contacts', clientId: contactsMatch[1] };
  }
  const sessionEditMatch = path.match(/^sessions\/edit\/([a-zA-Z0-9_-]+)$/) || path.match(/^session\/([a-zA-Z0-9_-]+)\/edit$/);
  if (sessionEditMatch && sessionEditMatch[1]) {
    return { tab: 'session-edit', sessionId: sessionEditMatch[1] };
  }

  const urlParams = new URLSearchParams(window.location.search);
  const subTabParam = urlParams.get('subtab') || urlParams.get('sub');
  const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  const reportsSubTab = subTabParam === 'shared-links' || subTabParam === 'approved' || hash === 'reports-approved' ? 'shared-links' : undefined;

  if (VALID_TABS.includes(path as TabType)) {
    return { tab: path as TabType, reportsSubTab };
  }

  const tabParam = (urlParams.get('tab') || urlParams.get('page'))?.toLowerCase();
  if (tabParam && VALID_TABS.includes(tabParam as TabType)) {
    return { tab: tabParam as TabType, reportsSubTab };
  }

  if (VALID_TABS.includes(hash as TabType)) {
    return { tab: hash as TabType, reportsSubTab };
  }

  return { tab: 'timer' };
}

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

  // Invite Token detection (POST /api/invites/:token/accept flow)
  const [inviteToken, setInviteToken] = useState<string | null>(() => {
    const pathMatch = window.location.pathname.match(/\/invite\/([a-zA-Z0-9_-]+)/);
    if (pathMatch && pathMatch[1]) return pathMatch[1];
    const urlParams = new URLSearchParams(window.location.search);
    const invParam = urlParams.get('invite') || urlParams.get('invite_token') || urlParams.get('inviteToken');
    if (invParam) return invParam;
    return null;
  });

  // Main App State with URL and LocalStorage persistence
  const initialRoute = getTabFromUrl();
  const [activeTab, setActiveTabState] = useState<TabType>(() => {
    if (initialRoute.tab) return initialRoute.tab;
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('last_active_tab') as TabType;
        if (saved && VALID_TABS.includes(saved)) return saved;
      } catch (e) {
        // Ignore
      }
    }
    return 'timer';
  });

  const [selectedClientId, setSelectedClientId] = useState<string | null>(initialRoute.clientId || null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(initialRoute.sessionId || null);
  const [reportsSubTab, setReportsSubTab] = useState<'overview' | 'shared-links'>(initialRoute.reportsSubTab || 'overview');

  const setActiveTab = useCallback((tab: TabType, updateHistory = true) => {
    setActiveTabState(tab);
    if (tab !== 'client-edit' && tab !== 'client-contacts') {
      setSelectedClientId(null);
    }
    if (tab !== 'session-edit') {
      setSelectedSessionId(null);
    }
    try {
      localStorage.setItem('last_active_tab', tab);
    } catch (e) {
      // Ignore
    }

    if (updateHistory && typeof window !== 'undefined') {
      let url = `/${tab}`;
      if (tab === 'client-new') url = '/clients/new';
      const currentCleanPath = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
      if (currentCleanPath !== tab && !window.location.pathname.startsWith('/shared/')) {
        window.history.pushState({ tab }, '', url);
      }
    }
  }, []);

  const navigateToNewClient = () => {
    setActiveTabState('client-new');
    setSelectedClientId(null);
    if (typeof window !== 'undefined') {
      window.history.pushState({ tab: 'client-new' }, '', '/clients/new');
    }
  };

  const navigateToEditClient = (clientId: string) => {
    setActiveTabState('client-edit');
    setSelectedClientId(clientId);
    if (typeof window !== 'undefined') {
      window.history.pushState({ tab: 'client-edit', clientId }, '', `/clients/edit/${clientId}`);
    }
  };

  const navigateToClientContacts = (clientId: string) => {
    setActiveTabState('client-contacts');
    setSelectedClientId(clientId);
    if (typeof window !== 'undefined') {
      window.history.pushState({ tab: 'client-contacts', clientId }, '', `/clients/contacts/${clientId}`);
    }
  };

  const navigateToEditSession = (sessionId: string) => {
    setActiveTabState('session-edit');
    setSelectedSessionId(sessionId);
    if (typeof window !== 'undefined') {
      window.history.pushState({ tab: 'session-edit', sessionId }, '', `/sessions/edit/${sessionId}`);
    }
  };

  const navigateToClientsList = () => {
    setActiveTab('clients');
  };

  const navigateToHistory = () => {
    setActiveTab('history');
  };

  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [activeSession, setActiveSession] = useState<TimeSession | null>(null);
  const [sessions, setSessions] = useState<TimeSession[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [resumeSession, setResumeSession] = useState<TimeSession | null>(null);
  const [linkedClients, setLinkedClients] = useState<LinkedClientItem[]>([]);
  const [loadingLinkedClients, setLoadingLinkedClients] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState<boolean>(false);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState<boolean>(false);

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

  // Active client for dynamic title (Etapa 01)
  const activeClient = clients.find((c) => c.id === activeSession?.client_id);

  // Synchronize document.title dynamically in real-time (Etapa 01)
  useDynamicDocumentTitle({
    activeSession,
    clientName: activeClient?.name,
  });

  // Global timer toggle for shortcuts (Alt + S / Shift + Space)
  const handleToggleTimer = useCallback(() => {
    if (activeSession) {
      if (activeTab !== 'timer') {
        setActiveTab('timer');
      }
      window.dispatchEvent(new CustomEvent('cronos:open-stop-modal'));
    } else {
      if (activeTab !== 'timer') {
        setActiveTab('timer');
      }
      window.dispatchEvent(new CustomEvent('cronos:trigger-start-timer'));
    }
  }, [activeSession, activeTab, setActiveTab]);

  // Global Keyboard Shortcuts (Etapa 01)
  useKeyboardShortcuts({
    onToggleTimer: handleToggleTimer,
    onOpenCommandPalette: () => setCommandPaletteOpen((prev) => !prev),
    onCloseModals: () => {
      if (commandPaletteOpen) {
        setCommandPaletteOpen(false);
        return;
      }
      if (shortcutsHelpOpen) {
        setShortcutsHelpOpen(false);
        return;
      }
      if (authModalOpen) {
        setAuthModalOpen(false);
        return;
      }
    },
    onOpenShortcutsHelp: () => setShortcutsHelpOpen((prev) => !prev),
  });

  // Synchronize initial URL if loaded at root '/' without losing active tab
  useEffect(() => {
    if (typeof window !== 'undefined' && !publicToken) {
      const cleanPath = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
      if (!cleanPath && !window.location.search && !window.location.hash) {
        window.history.replaceState({ tab: activeTab }, '', `/${activeTab}`);
      }
    }
  }, [activeTab, publicToken]);

  // Listen to popstate or hashchange (Browser back/forward buttons and direct URL navigation)
  useEffect(() => {
    const handleUrlChange = () => {
      const pathMatch = window.location.pathname.match(/\/shared\/([a-zA-Z0-9_-]+)/);
      const hashMatch = window.location.hash.match(/shared\/([a-zA-Z0-9_-]+)/);
      const urlParams = new URLSearchParams(window.location.search);
      const token = pathMatch?.[1] || hashMatch?.[1] || urlParams.get('share') || urlParams.get('token');
      
      if (token) {
        setPublicToken(token);
        return;
      } else {
        setPublicToken(null);
      }

      const urlRoute = getTabFromUrl();
      if (urlRoute && urlRoute.tab) {
        setActiveTabState(urlRoute.tab);
        setSelectedClientId(urlRoute.clientId || null);
        try {
          localStorage.setItem('last_active_tab', urlRoute.tab);
        } catch (e) {}
      }
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
      const res = await apiFetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setTenant(data.tenant);
        const effectiveTz = data.user?.timezone || data.tenant?.timezone;
        if (effectiveTz && typeof window !== 'undefined') {
          localStorage.setItem('cronos_user_timezone', effectiveTz);
        }
      }
    } catch (err) {
      console.error('Error fetching user:', err);
    }
  }, []);

  // Fetch Active Session (RF03 / RF5.2)
  const fetchActiveSession = useCallback(async () => {
    try {
      const res = await apiFetch('/api/sessions/active');
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
      const res = await apiFetch('/api/sessions');
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
      const res = await apiFetch('/api/clients');
      if (res.ok) {
        const data = await res.json();
        setClients(data.clients || []);
      }
    } catch (err) {
      console.error('Error fetching clients:', err);
    }
  }, []);

  // Fetch Linked Clients (clients matching user's email across any workspace)
  const fetchLinkedClients = useCallback(async (autoSwitchIfFound = false) => {
    try {
      setLoadingLinkedClients(true);
      const res = await apiFetch('/api/auth/linked-clients');
      if (res.ok) {
        const data = await res.json();
        const list: LinkedClientItem[] = data.linked_clients || [];
        setLinkedClients(list);
        if (list.length > 0 && autoSwitchIfFound) {
          setActiveTab('linked-clients');
          addToast({
            title: 'Vínculos de Cliente Ativos',
            description: `Seu e-mail está associado a ${list.length} cliente(s) no sistema. Uma área de visualização dedicada foi aberta.`,
            variant: 'default',
          });
        }
      }
    } catch (err) {
      console.error('Error fetching linked clients:', err);
    } finally {
      setLoadingLinkedClients(false);
    }
  }, [setActiveTab, addToast]);

  // Initial Load: check authentication
  useEffect(() => {
    async function init() {
      setLoading(true);
      await fetchAuthUser();
      setLoading(false);
    }
    init();
  }, [fetchAuthUser]);

  // Load app data only when user is authenticated
  useEffect(() => {
    if (user) {
      fetchActiveSession();
      fetchSessions();
      fetchClients();
      fetchLinkedClients(false);
    }
  }, [user, fetchActiveSession, fetchSessions, fetchClients, fetchLinkedClients]);

  // Handler for workspace changes
  const handleWorkspaceChange = useCallback(async () => {
    if (user) {
      await Promise.all([
        fetchActiveSession(),
        fetchSessions(),
        fetchClients(),
        fetchLinkedClients(false),
      ]);
    }
  }, [user, fetchActiveSession, fetchSessions, fetchClients, fetchLinkedClients]);

  useEffect(() => {
    const handleWsEvent = () => {
      handleWorkspaceChange();
    };
    window.addEventListener('workspace-changed', handleWsEvent);
    return () => window.removeEventListener('workspace-changed', handleWsEvent);
  }, [handleWorkspaceChange]);

  // Handler: Start Session (RF03)
  const handleStartSession = async (data: {
    title: string;
    notes?: string | null;
    target_minutes: number | null;
    previous_session_id: string | null;
    client_id: string | null;
    start_time?: string | null;
    retroactive_minutes?: number | null;
    retroactive_reason?: string | null;
  }) => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/sessions/start', {
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
      if (resData.session?.is_retroactive) {
        addToast({
          title: 'Cronômetro Retroativo Iniciado',
          description: `Sessão "${resData.session.title}" iniciada há ${resData.session.retroactive_minutes} min (Motivo: "${resData.session.retroactive_reason}").`,
          variant: 'success',
        });
      } else {
        addToast({
          title: 'Cronômetro Iniciado',
          description: `Sessão "${resData.session.title}" em andamento com horário oficial do servidor.`,
          variant: 'success',
        });
      }
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

  // Handler: Update Session Title while running
  const handleUpdateSessionTitle = async (sessionId: string, newTitle: string) => {
    const trimmed = newTitle.trim() || 'Sessão de Trabalho';
    try {
      const res = await apiFetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Erro ao atualizar título da sessão');
      }

      const resData = await res.json();
      setActiveSession((prev) => (prev ? { ...prev, title: resData.session.title } : null));
      addToast({
        title: 'Título atualizado!',
        description: `O título foi alterado para "${resData.session.title}".`,
        variant: 'success',
      });
      fetchSessions();
    } catch (err: any) {
      addToast({
        title: 'Erro ao alterar título',
        description: err.message,
        variant: 'destructive',
      });
      throw err;
    }
  };

  // Handler: Update Session Notes while running
  const handleUpdateSessionNotes = async (sessionId: string, newNotes: string) => {
    try {
      const res = await apiFetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: newNotes }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Erro ao atualizar observação da sessão');
      }

      const resData = await res.json();
      setActiveSession((prev) => (prev ? { ...prev, notes: resData.session.notes } : null));
      addToast({
        title: 'Observação atualizada',
        description: 'Observação da sessão de cronômetro salva com sucesso.',
        variant: 'success',
      });
      fetchSessions();
    } catch (err: any) {
      addToast({
        title: 'Erro ao alterar observação',
        description: err.message,
        variant: 'destructive',
      });
      throw err;
    }
  };

  // Handler: Stop Session (RF03)
  const handleStopSession = async (sessionId: string, newTitle?: string, newNotes?: string) => {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/sessions/${sessionId}/stop`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, notes: newNotes }),
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
        description: `"${stoppedSession.title}" concluída. Duração: ${formatDurationHuman(durationMs)} (${decimalHours.toFixed(
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
  const handleAddTask = async (sessionId: string, description: string, notes?: string, link?: string | null) => {
    try {
      const res = await apiFetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          time_session_id: sessionId,
          description,
          notes,
          link,
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

  // Handler: Update Task Notes
  const handleUpdateTaskNotes = async (taskId: string, notes: string) => {
    try {
      const res = await apiFetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Erro ao atualizar observação da tarefa');
      }

      const resData = await res.json();
      const updatedTask: TaskItem = resData.task;

      // Update active session locally if this task is in it
      setActiveSession((prev) => {
        if (!prev) return null;
        const currentTasks = prev.Tasks || prev.tasks || [];
        const updated = currentTasks.map((t) => (t.id === taskId ? { ...t, notes: updatedTask.notes } : t));
        return {
          ...prev,
          Tasks: updated,
          tasks: updated,
        };
      });

      // Also refresh sessions list in background
      fetchSessions();

      addToast({
        title: 'Observação salva',
        description: 'Observação da tarefa atualizada com sucesso.',
        variant: 'success',
      });
    } catch (err: any) {
      addToast({
        title: 'Erro ao salvar observação',
        description: err.message,
        variant: 'destructive',
      });
      throw err;
    }
  };

  // Handler: Delete Task (RF5.3)
  const handleDeleteTask = async (taskId: string) => {
    try {
      const res = await apiFetch(`/api/tasks/${taskId}`, {
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
      const res = await apiFetch(`/api/sessions/${sessionId}`, {
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
      const res = await apiFetch('/api/reports/share', {
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

  // Handler: Update Session (Title, Hourly Rate, Notes, Tasks) from History
  const handleUpdateSession = async (
    sessionId: string,
    data: {
      title?: string;
      hourly_rate?: number | null;
      notes?: string | null;
      client_id?: string | null;
      tasks?: Array<{ id?: string; description: string; notes?: string | null; link?: string | null; is_deleted?: boolean }>;
    }
  ) => {
    try {
      const res = await apiFetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Erro ao atualizar dados da sessão');
      }

      const resData = await res.json();
      const updatedSession: TimeSession = resData.session;

      // Update sessions state
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, ...updatedSession } : s))
      );

      // If active session matches, keep it synced
      if (activeSession?.id === sessionId) {
        setActiveSession((prev) => (prev ? { ...prev, ...updatedSession } : null));
      }

      addToast({
        title: 'Sessão Atualizada',
        description: 'Dados da sessão e tarefas salvos com sucesso.',
        variant: 'success',
      });
    } catch (err: any) {
      addToast({
        title: 'Não foi possível atualizar',
        description: err.message,
        variant: 'destructive',
      });
      throw err;
    }
  };

  // Handler: Update User Profile & Hourly Rate (RF07 / Settings)
  const handleUpdateProfile = async (data: {
    name: string;
    default_hourly_rate: number;
    tenant_name: string;
    default_target_minutes?: number | null;
    default_client_daily_target_minutes?: number | null;
    max_retroactive_minutes?: number | null;
    git_provider?: 'github' | 'gitlab' | null;
    github_repo?: string | null;
    github_token?: string | null;
    gitlab_url?: string | null;
    gitlab_project?: string | null;
    gitlab_token?: string | null;
    allowed_repositories?: string | null | GitRepositoryItem[];
    timezone?: string;
  }) => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/auth/profile', {
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

      const effectiveTz = resData.user?.timezone || data.timezone;
      if (effectiveTz && typeof window !== 'undefined') {
        localStorage.setItem('cronos_user_timezone', effectiveTz);
        window.dispatchEvent(new CustomEvent('timezone-changed', { detail: { timezone: effectiveTz } }));
      }

      addToast({
        title: 'Configurações Salvas!',
        description: 'Perfil e metas do workspace salvos com sucesso no banco de dados.',
        variant: 'success',
      });
    } catch (err: any) {
      addToast({
        title: 'Erro ao Salvar',
        description: err.message || 'Falha ao comunicar com o servidor.',
        variant: 'destructive',
      });
      throw err;
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
          window.history.pushState({ tab: activeTab }, '', `/${activeTab}`);
        }}
      />
    );
  }

  // Invite Acceptance flow
  if (inviteToken) {
    return (
      <InviteAcceptView
        token={inviteToken}
        onAccepted={(loggedInUser, loggedInTenant) => {
          setUser(loggedInUser);
          setTenant(loggedInTenant);
          setInviteToken(null);
          if (typeof window !== 'undefined') {
            window.history.replaceState({}, '', '/');
          }
        }}
        onCancel={() => {
          setInviteToken(null);
          if (typeof window !== 'undefined') {
            window.history.replaceState({}, '', '/');
          }
        }}
      />
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-950 text-neutral-600 dark:text-neutral-400">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium">Carregando dados da sessão...</p>
      </div>
    );
  }

  // Force redirect to Login screen if not authenticated
  if (!user) {
    return (
      <LoginView
        onLoginSuccess={(loggedInUser, loggedInTenant, hasLinkedClients) => {
          setUser(loggedInUser);
          setTenant(loggedInTenant);
          if (hasLinkedClients) {
            fetchLinkedClients(true);
          } else {
            fetchLinkedClients(false);
          }
        }}
      />
    );
  }

  const hourlyRate = user.default_hourly_rate || 150.0;

  return (
    <div className={`bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col md:flex-row font-sans transition-colors ${
      activeTab === 'assistant'
        ? 'h-[100dvh] max-h-[100dvh] overflow-hidden'
        : 'min-h-screen overflow-x-hidden'
    }`}>
      {/* Lateral Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab.startsWith('client-') ? 'clients' : activeTab as any}
        setActiveTab={setActiveTab}
        user={user}
        tenant={tenant}
        activeSession={activeSession}
        onOpenAuth={() => setAuthModalOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
        onWorkspaceChange={handleWorkspaceChange}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        onOpenShortcutsHelp={() => setShortcutsHelpOpen(true)}
      />

      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Main Container */}
        <main className={`w-full flex flex-col ${
          activeTab === 'assistant'
            ? 'flex-1 min-h-0 h-full p-0 m-0 max-w-none pb-14 md:pb-0 overflow-hidden'
            : 'flex-1 py-8 max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 items-center justify-center'
        }`}>
        <div className={`w-full ${
          activeTab === 'assistant'
            ? 'h-full flex-1 min-h-0 flex flex-col overflow-hidden'
            : 'space-y-6'
        }`}>

            {activeTab === 'timer' && (
              <TimerView
                activeSession={activeSession}
                clients={clients}
                tenant={tenant}
                sessions={sessions}
                hourlyRate={hourlyRate}
                resumeSession={resumeSession}
                onClearResumeSession={() => setResumeSession(null)}
                onStartSession={handleStartSession}
                onStopSession={handleStopSession}
                onUpdateSessionTitle={handleUpdateSessionTitle}
                onUpdateSessionNotes={handleUpdateSessionNotes}
                onAddTask={handleAddTask}
                onUpdateTaskNotes={handleUpdateTaskNotes}
                onDeleteTask={handleDeleteTask}
                onRefreshData={async () => {
                  await fetchActiveSession();
                  await fetchSessions();
                }}
                onNavigateToSettings={() => setActiveTab('settings')}
                loading={loading}
                currentUserId={user?.id || ''}
                addToast={addToast}
                onClientCreated={(client) => {
                  setClients((prev) => [...prev, client]);
                  addToast({
                    title: 'Cliente criado!',
                    description: `O cliente "${client.name}" foi cadastrado com sucesso e selecionado.`,
                    variant: 'success',
                  });
                }}
                onNavigate={(tab) => setActiveTab(tab)}
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
                initialSubTab={reportsSubTab}
                currentUser={user}
              />
            )}

            {activeTab === 'team-progress' && (
              <TeamProgressView
                currentUser={user}
                setActiveTab={setActiveTab}
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
                onUpdateSession={handleUpdateSession}
                onEditSession={navigateToEditSession}
                loading={loading}
              />
            )}

            {activeTab === 'session-edit' && (
              <SessionEditView
                session={sessions.find((s) => s.id === selectedSessionId) || (activeSession?.id === selectedSessionId ? activeSession : null)}
                clients={clients}
                hourlyRate={hourlyRate}
                onUpdateSession={async (sId, data) => {
                  await handleUpdateSession(sId, data);
                  navigateToHistory();
                }}
                onBack={navigateToHistory}
              />
            )}

            {activeTab === 'clients' && (
              <ClientsView
                clients={clients}
                tenant={tenant}
                onRefreshClients={fetchClients}
                defaultHourlyRate={hourlyRate}
                onNavigateToNewClient={navigateToNewClient}
                onNavigateToEditClient={navigateToEditClient}
                onNavigateToClientContacts={navigateToClientContacts}
              />
            )}

            {activeTab === 'notes' && (
              <NotesView
                currentUserId={user?.id || ''}
                addToast={addToast}
              />
            )}

            {activeTab === 'client-new' && (
              <ClientFormView
                tenant={tenant}
                onRefreshClients={fetchClients}
                onBack={navigateToClientsList}
                defaultHourlyRate={hourlyRate}
              />
            )}

            {activeTab === 'client-edit' && (
              <ClientFormView
                client={clients.find((c) => c.id === selectedClientId)}
                tenant={tenant}
                onRefreshClients={fetchClients}
                onBack={navigateToClientsList}
                defaultHourlyRate={hourlyRate}
              />
            )}

            {activeTab === 'client-contacts' && selectedClientId && (
              <ClientContactsView
                clientId={selectedClientId}
                clients={clients}
                onRefreshClients={fetchClients}
                onBack={navigateToClientsList}
              />
            )}

            {(activeTab === 'settings' || activeTab === 'linked-clients') && (
              <SettingsView
                user={user}
                tenant={tenant}
                clients={clients}
                onRefreshClients={fetchClients}
                linkedClients={linkedClients}
                loadingLinkedClients={loadingLinkedClients}
                onRefreshLinkedClients={() => fetchLinkedClients(false)}
                onUpdateProfile={handleUpdateProfile}
                loading={loading}
                initialTab={activeTab === 'linked-clients' ? 'linked-clients' : 'profile'}
              />
            )}

            {activeTab === 'assistant' && (
              <AiAssistantView
                user={user}
                tenant={tenant}
                activeSession={activeSession}
                sessions={sessions}
                clients={clients}
                onRefreshData={async () => {
                  await fetchActiveSession();
                  await fetchSessions();
                  await fetchClients();
                }}
                onNavigateToTimer={() => setActiveTab('timer')}
                onNavigateToSettings={() => setActiveTab('settings')}
                onNavigateToNotes={() => setActiveTab('notes')}
              />
            )}
          </div>
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

      {/* Footer (hidden on assistant chat tab for fixed Gemini-style layout) */}
      {activeTab !== 'assistant' && (
        <footer className="border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 py-6 text-center text-xs text-neutral-500 dark:text-neutral-400">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-center gap-2">
            <p>
              Time Tracking &amp; Faturamento
            </p>
          </div>
        </footer>
      )}
      </div>

      {/* Command Palette Modal (Etapa 01) */}
      <CommandPaletteModal
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onNavigate={(tab) => {
          setActiveTab(tab as TabType);
        }}
        onToggleTimer={handleToggleTimer}
        onNewNote={() => {
          setActiveTab('notes');
        }}
        onNewClient={() => {
          navigateToNewClient();
        }}
        onToggleTheme={toggleTheme}
        onOpenShortcutsHelp={() => setShortcutsHelpOpen(true)}
        activeSession={activeSession}
        clients={clients}
        theme={theme}
      />

      {/* Shortcuts Cheat Sheet Modal (Etapa 01) */}
      <ShortcutsHelpModal
        open={shortcutsHelpOpen}
        onOpenChange={setShortcutsHelpOpen}
      />

      {/* Auth / Account Switcher Modal */}
      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        currentUser={user}
        currentTenant={tenant}
        activeSession={activeSession}
        onLoginSuccess={(u, t, hasLinkedClients) => {
          setUser(u);
          setTenant(t);
          fetchActiveSession();
          fetchSessions();
          fetchClients();
          if (hasLinkedClients) {
            fetchLinkedClients(true);
          } else {
            fetchLinkedClients(false);
          }
        }}
        onLogoutSuccess={() => {
          setUser(null);
          setTenant(null);
          setLinkedClients([]);
          setActiveSession(null);
          setSessions([]);
          setClients([]);
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
