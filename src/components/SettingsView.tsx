import React, { useState, useEffect } from 'react';
import {
  Save,
  User as UserIcon,
  Building2,
  DollarSign,
  Shield,
  Bell,
  BellRing,
  BellOff,
  CheckCircle2,
  Target,
  Clock,
  Briefcase,
  Check,
  Github,
  GitBranch,
  Key,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  AlertCircle,
  Server,
  BookOpen,
  Globe,
  GitPullRequest,
  HelpCircle,
  CreditCard,
  Users,
  UserCheck,
  Download,
  FileJson,
  Database,
  Lock,
  Compass,
  Sparkles,
  History,
} from 'lucide-react';
import { User, Tenant, Client, GitRepositoryItem, LinkedClientItem } from '../types';
import { formatCurrency } from '../utils/format';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { useToast } from './ui/toast';
import { requestNotificationPermission, showNativeNotification } from '../lib/notifications';
import { apiFetch } from '../utils/api';
import { GitCredentialsGuideModal } from './GitCredentialsGuideModal';
import { GitRepositoryPermissionManager } from './GitRepositoryPermissionManager';
import { BillingSettingsTab } from './BillingSettingsTab';
import { TeamMembersSettingsTab } from './TeamMembersSettingsTab';
import { LinkedClientsView } from './LinkedClientsView';

interface SettingsViewProps {
  user: User | null;
  tenant: Tenant | null;
  clients?: Client[];
  onRefreshClients?: () => Promise<void>;
  linkedClients?: LinkedClientItem[];
  loadingLinkedClients?: boolean;
  onRefreshLinkedClients?: () => Promise<void>;
  onUpdateProfile: (data: {
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
  }) => Promise<void>;
  loading: boolean;
  initialTab?: 'profile' | 'workspace' | 'git' | 'notifications' | 'billing' | 'team' | 'linked-clients';
}

const TIMEZONE_GROUPS = [
  {
    group: 'Brasil (Fusos Oficiais)',
    options: [
      { value: 'America/Sao_Paulo', label: 'Brasília / São Paulo / Rio / Sul (UTC-3 - Horário de Brasília)' },
      { value: 'America/Fortaleza', label: 'Nordeste: Fortaleza / Salvador / Recife / Natal (UTC-3)' },
      { value: 'America/Belem', label: 'Norte: Belém / Amapá (UTC-3)' },
      { value: 'America/Manaus', label: 'Amazonas: Manaus / Boa Vista (UTC-4)' },
      { value: 'America/Cuiaba', label: 'Centro-Oeste: Cuiabá / Campo Grande (UTC-4)' },
      { value: 'America/Porto_Velho', label: 'Rondônia: Porto Velho (UTC-4)' },
      { value: 'America/Rio_Branco', label: 'Acre: Rio Branco (UTC-5)' },
      { value: 'America/Noronha', label: 'Fernando de Noronha (UTC-2)' },
    ],
  },
  {
    group: 'América do Sul & Latina',
    options: [
      { value: 'America/Buenos_Aires', label: 'Argentina: Buenos Aires (UTC-3)' },
      { value: 'America/Montevideo', label: 'Uruguai: Montevidéu (UTC-3)' },
      { value: 'America/Santiago', label: 'Chile: Santiago (UTC-4/-3)' },
      { value: 'America/Bogota', label: 'Colômbia: Bogotá (UTC-5)' },
      { value: 'America/Lima', label: 'Peru: Lima (UTC-5)' },
      { value: 'America/Mexico_City', label: 'México: Cidade do México (UTC-6)' },
    ],
  },
  {
    group: 'América do Norte',
    options: [
      { value: 'America/New_York', label: 'EUA: Nova York / Miami (UTC-5 / EDT)' },
      { value: 'America/Chicago', label: 'EUA: Chicago / Central (UTC-6 / CDT)' },
      { value: 'America/Denver', label: 'EUA: Denver / Mountain (UTC-7 / MDT)' },
      { value: 'America/Los_Angeles', label: 'EUA: Los Angeles / San Francisco (UTC-8 / PDT)' },
    ],
  },
  {
    group: 'Europa & Outros',
    options: [
      { value: 'Europe/Lisbon', label: 'Portugal: Lisboa / Porto (WET/WEST)' },
      { value: 'Europe/Madrid', label: 'Espanha: Madrid / Barcelona (CET/CEST)' },
      { value: 'Europe/London', label: 'Reino Unido: Londres (GMT/BST)' },
      { value: 'Europe/Paris', label: 'França: Paris (CET/CEST)' },
      { value: 'Europe/Berlin', label: 'Alemanha: Berlim (CET/CEST)' },
      { value: 'UTC', label: 'UTC (Tempo Universal Coordenado - UTC+0)' },
    ],
  },
];

export function SettingsView({
  user,
  tenant,
  clients = [],
  onRefreshClients,
  linkedClients = [],
  loadingLinkedClients = false,
  onRefreshLinkedClients,
  onUpdateProfile,
  loading,
  initialTab = 'profile',
}: SettingsViewProps) {
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<'profile' | 'workspace' | 'git' | 'notifications' | 'billing' | 'team' | 'linked-clients'>(initialTab);

  const [name, setName] = useState(user?.name || '');
  const [hourlyRate, setHourlyRate] = useState(
    user?.default_hourly_rate ? user.default_hourly_rate.toString() : '150'
  );
  const [tenantName, setTenantName] = useState(tenant?.name || '');
  const [timezone, setTimezone] = useState(
    user?.timezone || tenant?.timezone || 'America/Sao_Paulo'
  );
  const [currentTimeInZone, setCurrentTimeInZone] = useState('');
  const [defaultTargetMinutes, setDefaultTargetMinutes] = useState(
    tenant?.default_target_minutes ? tenant.default_target_minutes.toString() : '60'
  );
  const [defaultClientDailyTargetMinutes, setDefaultClientDailyTargetMinutes] = useState(
    tenant?.default_client_daily_target_minutes ? tenant.default_client_daily_target_minutes.toString() : '120'
  );
  const [maxRetroactiveMinutes, setMaxRetroactiveMinutes] = useState(
    tenant?.max_retroactive_minutes !== undefined && tenant?.max_retroactive_minutes !== null
      ? tenant.max_retroactive_minutes.toString()
      : '120'
  );

  // Git Provider & Integration state
  const [gitProvider, setGitProvider] = useState<'github' | 'gitlab'>('github');

  // GitHub state
  const [githubRepo, setGithubRepo] = useState(tenant?.github_repo || '');
  const [githubToken, setGithubToken] = useState(tenant?.github_token || '');
  const [showGithubToken, setShowGithubToken] = useState(false);
  const [testingGithub, setTestingGithub] = useState(false);
  const [githubTestStatus, setGithubTestStatus] = useState<{
    success: boolean;
    message: string;
    commitsCount?: number;
  } | null>(null);

  // GitLab state (SaaS and Self-Hosted / On-Premise)
  const [gitlabInstanceType, setGitlabInstanceType] = useState<'cloud' | 'selfhosted'>('cloud');
  const [gitlabUrl, setGitlabUrl] = useState(tenant?.gitlab_url || 'https://gitlab.com');
  const [gitlabProject, setGitlabProject] = useState(tenant?.gitlab_project || '');
  const [gitlabToken, setGitlabToken] = useState(tenant?.gitlab_token || '');
  const [showGitlabToken, setShowGitlabToken] = useState(false);
  const [testingGitlab, setTestingGitlab] = useState(false);
  const [gitlabTestStatus, setGitlabTestStatus] = useState<{
    success: boolean;
    message: string;
    commitsCount?: number;
  } | null>(null);

  // Guide Modal State
  const [guideModalOpen, setGuideModalOpen] = useState(false);
  const [guideModalTab, setGuideModalTab] = useState<'github' | 'gitlab' | 'selfhosted' | 'terminal'>('github');

  // Allowed Repositories state
  const [allowedRepositories, setAllowedRepositories] = useState<GitRepositoryItem[]>(() => {
    if (tenant?.allowed_repositories) {
      try {
        const parsed = JSON.parse(tenant.allowed_repositories);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  // Workspace Export state
  const [canExport, setCanExport] = useState(false);
  const [billingPlanId, setBillingPlanId] = useState('free');
  const [exportingWorkspace, setExportingWorkspace] = useState(false);

  useEffect(() => {
    apiFetch('/api/billing/status')
      .then((res) => res.json())
      .then((data) => {
        if (data?.plan?.id) {
          setBillingPlanId(data.plan.id);
          setCanExport(Boolean(data.can_export_workspace ?? (data.plan.id === 'pro' || data.plan.id === 'team')));
        }
      })
      .catch((err) => console.warn('Could not load billing status in settings:', err));
  }, []);

  const handleExportWorkspace = async () => {
    try {
      setExportingWorkspace(true);
      const res = await apiFetch('/api/workspaces/export');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao exportar dados do workspace');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (tenant?.name || 'workspace').toLowerCase().replace(/[^a-z0-9_-]/gi, '_');
      a.download = `cronos-workspace-${safeName}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      addToast({
        title: 'Exportação concluída!',
        description: 'Os dados completos do seu workspace foram exportados em formato JSON estruturado com sucesso.',
        variant: 'success',
      });
    } catch (err: any) {
      addToast({
        title: 'Falha na Exportação',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setExportingWorkspace(false);
    }
  };



  const [notificationPermission, setNotificationPermission] = useState<string>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });

  const handleToggleNotifications = async () => {
    if (!('Notification' in window)) {
      addToast({
        title: 'Não suportado',
        description: 'Seu navegador atual não possui suporte à API de notificações.',
        variant: 'destructive',
      });
      return;
    }

    if (notificationPermission === 'granted') {
      showNativeNotification('TimeTracker', {
        body: 'Notificações ativas! Você será alertado quando metas de tempo forem atingidas.',
      });
      addToast({
        title: 'Notificação enviada',
        description: 'Um alerta de teste foi disparado com sucesso no seu dispositivo.',
        variant: 'success',
      });
      return;
    }

    const granted = await requestNotificationPermission();
    setNotificationPermission(Notification.permission);

    if (granted) {
      addToast({
        title: 'Notificações Ativadas!',
        description: 'Você receberá alertas nativos quando as metas de tempo de suas sessões forem atingidas.',
        variant: 'success',
      });
      showNativeNotification('TimeTracker - Notificações Ativadas', {
        body: 'Tudo pronto! Você será alertado quando atingir a meta da sua sessão.',
      });
    } else {
      addToast({
        title: 'Permissão não concedida',
        description: 'As notificações não foram autorizadas. Verifique as permissões nas configurações do seu navegador.',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    const updateTime = () => {
      try {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('pt-BR', {
          timeZone: timezone || 'America/Sao_Paulo',
          dateStyle: 'full',
          timeStyle: 'medium',
        });
        setCurrentTimeInZone(formatter.format(now));
      } catch (e) {
        setCurrentTimeInZone('');
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [timezone]);

  const handleAutoDetectTimezone = () => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected) {
        setTimezone(detected);
        addToast({
          title: 'Fuso Horário Detectado!',
          description: `Definido para "${detected}" com base no seu navegador.`,
          variant: 'success',
        });
      }
    } catch (e) {
      addToast({
        title: 'Não foi possível detectar',
        description: 'Selecione seu fuso horário manualmente na lista.',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (user) {
      setName(user.name);
      setHourlyRate(user.default_hourly_rate.toString());
      if (user.timezone) {
        setTimezone(user.timezone);
      }
    }
    if (tenant) {
      setTenantName(tenant.name);
      if (!user?.timezone && tenant.timezone) {
        setTimezone(tenant.timezone);
      }
      if (tenant.default_target_minutes !== undefined && tenant.default_target_minutes !== null) {
        setDefaultTargetMinutes(tenant.default_target_minutes.toString());
      }
      if (tenant.default_client_daily_target_minutes !== undefined && tenant.default_client_daily_target_minutes !== null) {
        setDefaultClientDailyTargetMinutes(tenant.default_client_daily_target_minutes.toString());
      }
      if (tenant.max_retroactive_minutes !== undefined && tenant.max_retroactive_minutes !== null) {
        setMaxRetroactiveMinutes(tenant.max_retroactive_minutes.toString());
      }
      if (tenant.git_provider) {
        setGitProvider(tenant.git_provider);
      }
      if (tenant.github_repo !== undefined) {
        setGithubRepo(tenant.github_repo || '');
      }
      if (tenant.github_token !== undefined) {
        setGithubToken(tenant.github_token || '');
      }
      if (tenant.gitlab_url !== undefined) {
        const url = tenant.gitlab_url || 'https://gitlab.com';
        setGitlabUrl(url);
        setGitlabInstanceType(url !== 'https://gitlab.com' && url.trim() !== '' ? 'selfhosted' : 'cloud');
      }
      if (tenant.gitlab_project !== undefined) {
        setGitlabProject(tenant.gitlab_project || '');
      }
      if (tenant.gitlab_token !== undefined) {
        setGitlabToken(tenant.gitlab_token || '');
      }
      if (tenant.allowed_repositories !== undefined) {
        try {
          const parsed = JSON.parse(tenant.allowed_repositories || '[]');
          setAllowedRepositories(Array.isArray(parsed) ? parsed : []);
        } catch {
          setAllowedRepositories([]);
        }
      }
    }
  }, [user, tenant]);

  const handleTestGitHub = async () => {
    if (!githubRepo.trim()) {
      addToast({
        title: 'Repositório não informado',
        description: 'Informe o repositório no formato "dono/projeto" ou a URL do GitHub antes de testar.',
        variant: 'destructive',
      });
      return;
    }

    setTestingGithub(true);
    setGithubTestStatus(null);
    try {
      const res = await apiFetch('/api/git/commits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'github',
          repo: githubRepo.trim(),
          token: githubToken.trim() || undefined,
          per_page: 5,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao conectar com o repositório no GitHub');
      }

      const count = data.commits?.length || 0;
      setGithubTestStatus({
        success: true,
        message: `Conexão bem-sucedida! Repositório "${data.repo}" respondeu com ${count} commits recentes.`,
        commitsCount: count,
      });

      addToast({
        title: 'GitHub Conectado!',
        description: `Repositório "${data.repo}" acessível (${count} commits encontrados).`,
        variant: 'success',
      });
    } catch (err: any) {
      setGithubTestStatus({
        success: false,
        message: err.message || 'Erro de conexão com o GitHub',
      });
      addToast({
        title: 'Falha na Conexão',
        description: err.message || 'Não foi possível acessar o repositório',
        variant: 'destructive',
      });
    } finally {
      setTestingGithub(false);
    }
  };

  const handleTestGitLab = async () => {
    if (!gitlabProject.trim()) {
      addToast({
        title: 'Projeto não informado',
        description: 'Informe o projeto (ex: "grupo/projeto", ID numérico ou URL) antes de testar.',
        variant: 'destructive',
      });
      return;
    }

    const targetUrl = gitlabInstanceType === 'cloud' ? 'https://gitlab.com' : gitlabUrl.trim() || 'https://gitlab.com';

    setTestingGitlab(true);
    setGitlabTestStatus(null);
    try {
      const res = await apiFetch('/api/git/commits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'gitlab',
          project: gitlabProject.trim(),
          gitlabUrl: targetUrl,
          token: gitlabToken.trim() || undefined,
          per_page: 5,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao conectar com o projeto no GitLab');
      }

      const count = data.commits?.length || 0;
      setGitlabTestStatus({
        success: true,
        message: `Conexão bem-sucedida! Projeto "${data.repo || gitlabProject}" respondeu com ${count} commits recentes na branch padrão.`,
        commitsCount: count,
      });

      addToast({
        title: 'GitLab Conectado!',
        description: `Projeto acessível com sucesso (${count} commits encontrados).`,
        variant: 'success',
      });
    } catch (err: any) {
      setGitlabTestStatus({
        success: false,
        message: err.message || 'Erro de conexão com o GitLab / Self-Hosted',
      });
      addToast({
        title: 'Falha na Conexão com GitLab',
        description: err.message || 'Não foi possível acessar o projeto',
        variant: 'destructive',
      });
    } finally {
      setTestingGitlab(false);
    }
  };



  const handleSubmit = async (e?: React.FormEvent | React.SyntheticEvent) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    const rateNum = parseFloat(hourlyRate);
    if (isNaN(rateNum) || rateNum < 0) {
      addToast({
        title: 'Valor inválido',
        description: 'Por favor informe uma taxa por hora válida maior ou igual a zero.',
        variant: 'destructive',
      });
      return;
    }

    const targetMinNum = defaultTargetMinutes.trim() ? parseInt(defaultTargetMinutes, 10) : null;
    const clientDailyMinNum = defaultClientDailyTargetMinutes.trim()
      ? parseInt(defaultClientDailyTargetMinutes, 10)
      : null;
    const maxRetroNum = maxRetroactiveMinutes.trim() !== '' ? Math.max(0, parseInt(maxRetroactiveMinutes, 10)) : 120;

    await onUpdateProfile({
      name: name.trim(),
      default_hourly_rate: rateNum,
      tenant_name: tenantName.trim(),
      default_target_minutes: targetMinNum,
      default_client_daily_target_minutes: clientDailyMinNum,
      max_retroactive_minutes: maxRetroNum,
      git_provider: gitProvider,
      github_repo: githubRepo.trim() || null,
      github_token: githubToken.trim() || null,
      gitlab_url: (gitlabInstanceType === 'cloud' ? 'https://gitlab.com' : gitlabUrl.trim()) || 'https://gitlab.com',
      gitlab_project: gitlabProject.trim() || null,
      gitlab_token: gitlabToken.trim() || null,
      allowed_repositories: JSON.stringify(allowedRepositories),
      timezone: timezone.trim() || 'America/Sao_Paulo',
    });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
          Configurações &amp; Perfil
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
          Gerencie seu perfil, taxas de faturamento, metas do workspace, integrações Git e notificações.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        {/* Sidebar Menu */}
        <div className="md:col-span-1 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-2 shadow-2xs space-y-1 md:sticky md:top-6">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer text-left ${
                activeTab === 'profile'
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                  : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <UserIcon className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
              <span>Perfil &amp; Taxas</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('workspace')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer text-left ${
                activeTab === 'workspace'
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                  : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <Building2 className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
              <span>Workspace &amp; Metas</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('git')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer text-left ${
                activeTab === 'git'
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                  : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <GitBranch className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
              <span>Integração Git</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('notifications')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer text-left ${
                activeTab === 'notifications'
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                  : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <Bell className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
              <span>Notificações</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('team')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer text-left ${
                activeTab === 'team'
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                  : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <Users className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
              <span>Equipe &amp; Convites</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('billing')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer text-left ${
                activeTab === 'billing'
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                  : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <CreditCard className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
              <span>Plano &amp; Limites</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('linked-clients')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer text-left ${
                activeTab === 'linked-clients'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
                  : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <UserCheck className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="truncate">Meus Vínculos</span>
              </div>
              {linkedClients.length > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px] font-bold px-1.5 shadow-2xs">
                  {linkedClients.length}
                </span>
              )}
            </button>

            {['profile', 'workspace', 'git', 'notifications'].includes(activeTab) && (
              <div className="pt-3 mt-3 border-t border-neutral-200 dark:border-neutral-800 px-2">
                <Button
                  type="button"
                  onClick={() => handleSubmit()}
                  disabled={loading}
                  className="w-full gap-2 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 shadow-sm text-xs cursor-pointer justify-center"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{loading ? 'Salvando...' : 'Salvar Alterações'}</span>
                </Button>
              </div>
            )}
          </div>

          {/* Right Content Area */}
          <div className="md:col-span-3 space-y-6">
            {/* Form-based settings tabs: Perfil, Workspace, Git e Notificações */}
            {['profile', 'workspace', 'git', 'notifications'].includes(activeTab) && (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Tab 1: Perfil & Taxas */}
                {activeTab === 'profile' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Card 1: Faturamento & Taxa Horária */}
                <Card className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs">
                  <CardHeader>
                    <CardTitle className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      <span>Precificação &amp; Faturamento</span>
                    </CardTitle>
                    <CardDescription className="text-xs text-neutral-500 dark:text-neutral-400">
                      Este valor é utilizado nos relatórios para multiplicar automaticamente as horas decimais trabalhadas.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                        Valor Base por Hora (R$)
                      </label>
                      <div className="relative max-w-xs">
                        <span className="absolute left-3 top-2.5 text-xs text-neutral-400 font-semibold">
                          R$
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={hourlyRate}
                          onChange={(e) => setHourlyRate(e.target.value)}
                          className="pl-10 font-mono text-sm"
                          required
                        />
                      </div>
                      <p className="text-2xs text-neutral-400">
                        Pré-visualização: {formatCurrency(parseFloat(hourlyRate) || 0)} por hora faturável.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Card 2: Perfil do Usuário */}
                <Card className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs">
                  <CardHeader>
                    <CardTitle className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                      <UserIcon className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
                      <span>Dados do Profissional</span>
                    </CardTitle>
                    <CardDescription className="text-xs text-neutral-500 dark:text-neutral-400">
                      Identificação do prestador de serviços nos relatórios.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                          Nome Completo
                        </label>
                        <Input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="text-sm"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                          Email de Acesso
                        </label>
                        <Input
                          value={user?.email || ''}
                          disabled
                          className="text-sm bg-neutral-50 dark:bg-neutral-850 text-neutral-500 dark:text-neutral-400 cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Card 3: Fuso Horário & Cronos AI */}
                <Card className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs">
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <CardTitle className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                          <Globe className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                          <span>Fuso Horário do Usuário &amp; Cronos AI</span>
                        </CardTitle>
                        <CardDescription className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                          Define a zona temporal utilizada para registrar sessões, relatórios e orientar o Cronos AI para não responder em UTC.
                        </CardDescription>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAutoDetectTimezone}
                        className="gap-1.5 text-xs h-8 border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 self-start sm:self-auto cursor-pointer"
                        title="Detectar fuso horário configurado no navegador"
                      >
                        <Compass className="w-3.5 h-3.5" />
                        <span>Detectar do Navegador</span>
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-neutral-500" />
                        <span>Selecione o seu Fuso Horário (IANA)</span>
                      </label>
                      <select
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="w-full text-xs md:text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-850 px-3 py-2 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                      >
                        {TIMEZONE_GROUPS.map((group) => (
                          <optgroup key={group.group} label={group.group}>
                            {group.options.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                        {!TIMEZONE_GROUPS.some((g) => g.options.some((o) => o.value === timezone)) && (
                          <optgroup label="Outro / Personalizado">
                            <option value={timezone}>{timezone}</option>
                          </optgroup>
                        )}
                      </select>
                    </div>

                    {/* Live Clock & Cronos AI Status Banner */}
                    <div className="rounded-lg border border-indigo-100 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 p-3.5 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-indigo-950 dark:text-indigo-200">
                          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Relógio Local Ativo:</span>
                          <span className="font-mono text-indigo-700 dark:text-indigo-300 font-bold bg-white dark:bg-neutral-800 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                            {currentTimeInZone || 'Calculando...'}
                          </span>
                        </div>
                        <Badge variant="secondary" className="text-2xs font-mono">
                          {timezone}
                        </Badge>
                      </div>
                      <p className="text-2xs text-neutral-600 dark:text-neutral-400 flex items-start gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <span>
                          <strong>Cronos AI Sincronizado:</strong> Quando você perguntar "quanto trabalhei hoje?", "que horas iniciei?", ou pedir relatórios e projeções, o Cronos AI interpretará os horários estritamente no fuso <code>{timezone}</code> e nunca responderá em UTC puro.
                        </span>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Tab 2: Workspace & Metas */}
            {activeTab === 'workspace' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Card 3: Multitenancy & Workspace */}
                <Card className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs">
                  <CardHeader>
                    <CardTitle className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      <span>Espaço Multitenant (Workspace)</span>
                    </CardTitle>
                    <CardDescription className="text-xs text-neutral-500 dark:text-neutral-400">
                      Isolamento de dados por Tenant ID (RF02). Todas as sessões e anotações pertencem a este ambiente.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                        Nome do Workspace
                      </label>
                      <Input
                        value={tenantName}
                        onChange={(e) => setTenantName(e.target.value)}
                        className="text-sm"
                        required
                      />
                    </div>

                    <div className="rounded-lg border border-neutral-200 dark:border-neutral-750 bg-neutral-50 dark:bg-neutral-850 p-3 text-xs text-neutral-600 dark:text-neutral-300 space-y-1">
                      <div className="flex items-center gap-1.5 font-semibold text-neutral-800 dark:text-neutral-200">
                        <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span style={{ color: '#000000' }}>Tenant ID Ativo:</span>
                        <code className="font-mono text-2xs bg-white dark:bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-700">
                          {tenant?.id || user?.tenant_id}
                        </code>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Card: Metas & Objetivos de Tempo do Workspace */}
                <Card className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs">
                  <CardHeader>
                    <CardTitle className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                      <Target className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      <span>Metas &amp; Objetivos de Tempo do Workspace</span>
                    </CardTitle>
                    <CardDescription className="text-xs text-neutral-500 dark:text-neutral-400">
                      Defina os objetivos de tempo padrão gravados no banco de dados do workspace, bem como metas diárias padrão e personalizadas por cliente.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* 1. Objetivo de Tempo Padrão (Sessões) */}
                    <div className="space-y-2 p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-850/70">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          <span>Objetivo de Tempo Padrão (por sessão)</span>
                        </label>
                        <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                          {defaultTargetMinutes && parseInt(defaultTargetMinutes, 10) > 0
                            ? `${defaultTargetMinutes} min (${(parseInt(defaultTargetMinutes, 10) / 60).toFixed(1)}h)`
                            : 'Sem meta'}
                        </span>
                      </div>
                      <p className="text-2xs text-neutral-500 dark:text-neutral-400">
                        Valor pré-selecionado no cronômetro ao iniciar uma nova sessão. Salvo diretamente nos dados do workspace.
                      </p>
                      
                      <div className="flex flex-wrap gap-2 pt-1">
                        {[
                          { label: 'Sem meta', val: '' },
                          { label: '30m', val: '30' },
                          { label: '1 hora (60m)', val: '60' },
                          { label: '1h 30m (90m)', val: '90' },
                          { label: '2 horas (120m)', val: '120' },
                          { label: '4 horas (240m)', val: '240' },
                        ].map((chip) => (
                          <button
                            key={chip.label}
                            type="button"
                            onClick={() => setDefaultTargetMinutes(chip.val)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                              defaultTargetMinutes === chip.val
                                ? 'border-neutral-900 dark:border-neutral-100 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900'
                                : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                            }`}
                          >
                            {chip.label}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-xs text-neutral-600 dark:text-neutral-400">Ou digite em minutos:</span>
                        <Input
                          type="number"
                          min="0"
                          max="1440"
                          value={defaultTargetMinutes}
                          onChange={(e) => setDefaultTargetMinutes(e.target.value)}
                          placeholder="Ex: 60"
                          className="w-28 text-xs font-medium h-8"
                        />
                      </div>
                    </div>

                    {/* 2. Meta Diária Padrão por Cliente */}
                    <div className="space-y-2 p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-850/70">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                          <Target className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          <span>Meta Diária Padrão por Cliente</span>
                        </label>
                        <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                          {defaultClientDailyTargetMinutes && parseInt(defaultClientDailyTargetMinutes, 10) > 0
                            ? `${defaultClientDailyTargetMinutes} min (${(parseInt(defaultClientDailyTargetMinutes, 10) / 60).toFixed(1)}h)`
                            : 'Sem meta'}
                        </span>
                      </div>
                      <p className="text-2xs text-neutral-500 dark:text-neutral-400">
                        Meta diária aplicada para clientes que não tenham uma meta diária individual configurada. Calcula o progresso diário acumulado no dia da mesma forma que o Objetivo de Tempo.
                      </p>

                      <div className="flex flex-wrap gap-2 pt-1">
                        {[
                          { label: 'Sem meta', val: '' },
                          { label: '1 hora (60m)', val: '60' },
                          { label: '2 horas (120m)', val: '120' },
                          { label: '4 horas (240m)', val: '240' },
                          { label: '6 horas (360m)', val: '360' },
                          { label: '8 horas (480m)', val: '480' },
                        ].map((chip) => (
                          <button
                            key={chip.label}
                            type="button"
                            onClick={() => setDefaultClientDailyTargetMinutes(chip.val)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                              defaultClientDailyTargetMinutes === chip.val
                                ? 'border-indigo-600 bg-indigo-600 text-white dark:border-indigo-500 dark:bg-indigo-500'
                                : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                            }`}
                          >
                            {chip.label}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-xs text-neutral-600 dark:text-neutral-400">Ou digite em minutos diários:</span>
                        <Input
                          type="number"
                          min="0"
                          max="1440"
                          value={defaultClientDailyTargetMinutes}
                          onChange={(e) => setDefaultClientDailyTargetMinutes(e.target.value)}
                          placeholder="Ex: 120"
                          className="w-28 text-xs font-medium h-8"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Card: Limite de Início Retroativo do Cronômetro */}
                <Card className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs">
                  <CardHeader>
                    <CardTitle className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                      <History className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      <span>Limite de Início Retroativo do Cronômetro</span>
                    </CardTitle>
                    <CardDescription className="text-xs text-neutral-500 dark:text-neutral-400">
                      Configure o tempo máximo anterior/para trás que o usuário ou membro pode escolher ao iniciar um cronômetro retroativo. O preenchimento do motivo pelo usuário é obrigatório.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2 p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-850/70">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          <span>Máximo de Tempo Retroativo Permitido</span>
                        </label>
                        <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                          {maxRetroactiveMinutes === '0'
                            ? 'Desativado (0 min)'
                            : maxRetroactiveMinutes && parseInt(maxRetroactiveMinutes, 10) > 0
                            ? `${maxRetroactiveMinutes} min (${(parseInt(maxRetroactiveMinutes, 10) / 60).toFixed(1)}h)`
                            : 'Padrão (120 min / 2h)'}
                        </span>
                      </div>
                      <p className="text-2xs text-neutral-500 dark:text-neutral-400">
                        O dono do workspace define aqui o limite para trás que qualquer membro pode retroagir ao iniciar o timer (ex: quando esqueceu de acionar o cronômetro).
                      </p>

                      <div className="flex flex-wrap gap-2 pt-1">
                        {[
                          { label: 'Desativado (0m)', val: '0' },
                          { label: '30 min', val: '30' },
                          { label: '1 hora (60m)', val: '60' },
                          { label: '2 horas (120m)', val: '120' },
                          { label: '4 horas (240m)', val: '240' },
                          { label: '8 horas (480m)', val: '480' },
                          { label: '24 horas (1440m)', val: '1440' },
                        ].map((chip) => (
                          <button
                            key={chip.label}
                            type="button"
                            onClick={() => setMaxRetroactiveMinutes(chip.val)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                              maxRetroactiveMinutes === chip.val
                                ? 'border-indigo-600 bg-indigo-600 text-white dark:border-indigo-500 dark:bg-indigo-500'
                                : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                            }`}
                          >
                            {chip.label}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-xs text-neutral-600 dark:text-neutral-400">Ou digite em minutos máximos:</span>
                        <Input
                          type="number"
                          min="0"
                          max="10080"
                          value={maxRetroactiveMinutes}
                          onChange={(e) => setMaxRetroactiveMinutes(e.target.value)}
                          placeholder="Ex: 120"
                          className="w-28 text-xs font-medium h-8"
                        />
                        <span className="text-2xs text-neutral-500 dark:text-neutral-400">
                          (0 = desativado, 120 = 2 horas, 1440 = 24 horas)
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Card: Exportação Completa dos Dados do Workspace */}
                <Card className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                        <Database className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        <span>Backup &amp; Exportação Completa</span>
                      </CardTitle>
                      {canExport ? (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-0 text-3xs font-semibold">
                          Disponível no seu Plano
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-0 text-3xs font-semibold flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          <span>Exclusivo Pro &amp; Team</span>
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-xs text-neutral-500 dark:text-neutral-400">
                      Gera um arquivo completo em formato JSON contendo clientes, contatos, todas as sessões registradas, tarefas, relatórios compartilhados, histórico de faturas e membros do workspace.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {canExport ? (
                      <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-850/60 border border-neutral-200 dark:border-neutral-800 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                              <FileJson className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              <span>Exportar todos os dados deste Workspace (.json)</span>
                            </p>
                            <p className="text-2xs text-neutral-500 dark:text-neutral-400">
                              Portabilidade total sem perdas de registros históricos, metas, tags ou metadados Git.
                            </p>
                          </div>
                          <Button
                            type="button"
                            onClick={handleExportWorkspace}
                            disabled={exportingWorkspace}
                            className="shrink-0 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer shadow-xs gap-1.5"
                          >
                            {exportingWorkspace ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Exportando...</span>
                              </>
                            ) : (
                              <>
                                <Download className="w-3.5 h-3.5" />
                                <span>Baixar Backup Completo</span>
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-850/50 border border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                            <Lock className="w-4 h-4 text-amber-500" />
                            <span>Exportação completa bloqueada no plano Free</span>
                          </p>
                          <p className="text-2xs text-neutral-500 dark:text-neutral-400">
                            Faça upgrade para o plano Pro (apenas R$ 4,99/mês) ou Team para liberar o download de backup de todos os dados do seu workspace.
                          </p>
                        </div>
                        <Button
                          type="button"
                          onClick={() => setActiveTab('billing')}
                          className="shrink-0 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer shadow-xs"
                        >
                          <span>Fazer Upgrade</span>
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Tab 3: Integração Git */}
            {activeTab === 'git' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Card: Integração Git (GitHub, GitLab, Self-Hosted) */}
                <Card className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs">
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <CardTitle className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                        <GitBranch className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        <span>Integração Git: GitHub, GitLab &amp; Self-Hosted</span>
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setGuideModalTab(gitProvider === 'gitlab' ? (gitlabInstanceType === 'selfhosted' ? 'selfhosted' : 'gitlab') : 'github');
                            setGuideModalOpen(true);
                          }}
                          className="gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 cursor-pointer"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Guia de Tokens &amp; Credenciais</span>
                        </Button>
                        {((gitProvider === 'github' && tenant?.github_repo) || (gitProvider === 'gitlab' && tenant?.gitlab_project)) ? (
                          <Badge variant="success" className="gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="outline">Opcional</Badge>
                        )}
                      </div>
                    </div>
                    <CardDescription className="text-xs text-neutral-500 dark:text-neutral-400">
                      Conecte seu repositório de código (GitHub ou GitLab na nuvem / servidor corporativo on-premise) para importar commits com 1 clique e permitir que o Cronos AI analise as entregas técnicas e sugira tarefas detalhadas.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Provedor Switcher */}
                    <div className="flex items-center gap-2 p-1 rounded-lg bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-750">
                      <button
                        type="button"
                        onClick={() => setGitProvider('github')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                          gitProvider === 'github'
                            ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs'
                            : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                        }`}
                      >
                        <Github className="w-4 h-4" />
                        <span>GitHub</span>
                        {tenant?.github_repo && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>}
                      </button>
                      <button
                        type="button"
                        onClick={() => setGitProvider('gitlab')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                          gitProvider === 'gitlab'
                            ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs'
                            : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                        }`}
                      >
                        <Server className="w-4 h-4 text-amber-500" />
                        <span>GitLab &amp; Self-Hosted</span>
                        {tenant?.gitlab_project && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>}
                      </button>
                    </div>

                    {/* ABA GITHUB */}
                    {gitProvider === 'github' && (
                      <div className="space-y-4 pt-1">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                              <GitBranch className="w-3.5 h-3.5 text-indigo-500" />
                              <span>Repositório GitHub Padrão</span>
                            </label>
                            <Input
                              type="text"
                              placeholder="ex: organizacao/projeto ou URL"
                              value={githubRepo}
                              onChange={(e) => setGithubRepo(e.target.value)}
                              className="text-sm font-mono"
                            />
                            <p className="text-2xs text-neutral-500 dark:text-neutral-400">
                              Formato: <code className="text-2xs font-mono">dono/repositorio</code> ou URL completa.
                            </p>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                              <span className="flex items-center gap-1.5">
                                <Key className="w-3.5 h-3.5 text-amber-500" />
                                <span>Personal Access Token (PAT)</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setGuideModalTab('github');
                                  setGuideModalOpen(true);
                                }}
                                className="text-2xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                              >
                                <span>Como gerar</span>
                                <HelpCircle className="w-2.5 h-2.5" />
                              </button>
                            </label>
                            <div className="relative">
                              <Input
                                type={showGithubToken ? 'text' : 'password'}
                                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                                value={githubToken}
                                onChange={(e) => setGithubToken(e.target.value)}
                                className="text-sm font-mono pr-9"
                              />
                              <button
                                type="button"
                                onClick={() => setShowGithubToken(!showGithubToken)}
                                className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                                title={showGithubToken ? 'Ocultar token' : 'Exibir token'}
                              >
                                {showGithubToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                            <p className="text-2xs text-neutral-500 dark:text-neutral-400">
                              Necessário para repositórios privados e para eliminar limite de 60 req/h da API do GitHub.
                            </p>
                          </div>
                        </div>

                        {/* Test Connection Button & Status */}
                        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-neutral-100 dark:border-neutral-800">
                          <div className="text-2xs text-neutral-500 dark:text-neutral-400">
                            Ao salvar, este repositório ficará pré-selecionado no cronômetro e no Cronos AI.
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={testingGithub || !githubRepo.trim()}
                            onClick={handleTestGitHub}
                            className="shrink-0 gap-1.5 cursor-pointer text-xs"
                          >
                            {testingGithub ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Testando Acesso...</span>
                              </>
                            ) : (
                              <>
                                <Github className="w-3.5 h-3.5" />
                                <span>Testar Conexão</span>
                              </>
                            )}
                          </Button>
                        </div>

                        {githubTestStatus && (
                          <div
                            className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                              githubTestStatus.success
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                            }`}
                          >
                            {githubTestStatus.success ? (
                              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                            ) : (
                              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                            )}
                            <div className="space-y-0.5 flex-1">
                              <p className="font-semibold">
                                {githubTestStatus.success ? 'Conexão validada com sucesso' : 'Falha na conexão com GitHub'}
                              </p>
                              <p className="text-2xs opacity-90">{githubTestStatus.message}</p>
                            </div>
                          </div>
                        )}

                        {/* Permissões e Múltiplos Repositórios GitHub */}
                        <GitRepositoryPermissionManager
                          provider="github"
                          token={githubToken}
                          allowedRepositories={allowedRepositories}
                          onChangeAllowedRepositories={setAllowedRepositories}
                          defaultRepoFullName={githubRepo}
                          onSelectDefaultRepo={(repoFullName) => {
                            setGithubRepo(repoFullName);
                            addToast({
                              title: 'Repositório padrão definido',
                              description: `"${repoFullName}" agora é o repositório principal do GitHub.`,
                              variant: 'success',
                            });
                          }}
                        />
                      </div>
                    )}

                    {/* ABA GITLAB & SELF-HOSTED */}
                    {gitProvider === 'gitlab' && (
                      <div className="space-y-4 pt-1">
                        {/* Instance Type Switcher */}
                        <div className="flex items-center gap-3 p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850">
                          <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 shrink-0">
                            Tipo de Instalação:
                          </span>
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1.5 text-xs text-neutral-800 dark:text-neutral-200 cursor-pointer">
                              <input
                                type="radio"
                                name="gitlab_type"
                                checked={gitlabInstanceType === 'cloud'}
                                onChange={() => {
                                  setGitlabInstanceType('cloud');
                                  setGitlabUrl('https://gitlab.com');
                                }}
                                className="text-indigo-600 focus:ring-indigo-500"
                              />
                              <span>GitLab Cloud (gitlab.com)</span>
                            </label>
                            <label className="flex items-center gap-1.5 text-xs text-neutral-800 dark:text-neutral-200 cursor-pointer ml-3">
                              <input
                                type="radio"
                                name="gitlab_type"
                                checked={gitlabInstanceType === 'selfhosted'}
                                onChange={() => {
                                  setGitlabInstanceType('selfhosted');
                                  if (gitlabUrl === 'https://gitlab.com') {
                                    setGitlabUrl('');
                                  }
                                }}
                                className="text-indigo-600 focus:ring-indigo-500"
                              />
                              <span>Self-Hosted / Servidor Próprio</span>
                            </label>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Instance URL (if self-hosted) */}
                          {gitlabInstanceType === 'selfhosted' && (
                            <div className="sm:col-span-2 space-y-1.5">
                              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                  <Globe className="w-3.5 h-3.5 text-amber-500" />
                                  <span>URL Base da Instância GitLab</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setGuideModalTab('selfhosted');
                                    setGuideModalOpen(true);
                                  }}
                                  className="text-2xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                                >
                                  <span>Instruções Self-Hosted</span>
                                  <HelpCircle className="w-2.5 h-2.5" />
                                </button>
                              </label>
                              <Input
                                type="text"
                                placeholder="https://gitlab.minhaempresa.com.br ou http://192.168.1.50:8080"
                                value={gitlabUrl}
                                onChange={(e) => setGitlabUrl(e.target.value)}
                                className="text-sm font-mono"
                              />
                              <p className="text-2xs text-neutral-500 dark:text-neutral-400">
                                Informe o protocolo (<code className="text-2xs font-mono">https://</code>) e domínio ou IP/porta onde seu GitLab está hospedado.
                              </p>
                            </div>
                          )}

                          {/* Project Identifier */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                              <GitPullRequest className="w-3.5 h-3.5 text-amber-500" />
                              <span>Projeto / Repositório GitLab</span>
                            </label>
                            <Input
                              type="text"
                              placeholder="ex: grupo/projeto, ID 1234 ou URL"
                              value={gitlabProject}
                              onChange={(e) => setGitlabProject(e.target.value)}
                              className="text-sm font-mono"
                            />
                            <p className="text-2xs text-neutral-500 dark:text-neutral-400">
                              Aceita caminho com namespace (<code className="text-2xs font-mono">empresa/backend</code>), ID numérico do projeto ou URL completa.
                            </p>
                          </div>

                          {/* GitLab Token */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                              <span className="flex items-center gap-1.5">
                                <Key className="w-3.5 h-3.5 text-amber-500" />
                                <span>GitLab Access Token (PAT ou Project Token)</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setGuideModalTab(gitlabInstanceType === 'selfhosted' ? 'selfhosted' : 'gitlab');
                                  setGuideModalOpen(true);
                                }}
                                className="text-2xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                              >
                                <span>Onde gerar</span>
                                <HelpCircle className="w-2.5 h-2.5" />
                              </button>
                            </label>
                            <div className="relative">
                              <Input
                                type={showGitlabToken ? 'text' : 'password'}
                                placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
                                value={gitlabToken}
                                onChange={(e) => setGitlabToken(e.target.value)}
                                className="text-sm font-mono pr-9"
                              />
                              <button
                                type="button"
                                onClick={() => setShowGitlabToken(!showGitlabToken)}
                                className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                                title={showGitlabToken ? 'Ocultar token' : 'Exibir token'}
                              >
                                {showGitlabToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                            <p className="text-2xs text-neutral-500 dark:text-neutral-400">
                              Token pessoal ou de projeto com escopo <code className="text-2xs font-mono">read_api</code> ou <code className="text-2xs font-mono">read_repository</code>.
                            </p>
                          </div>
                        </div>

                        {/* Test Connection Button & Status */}
                        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-neutral-100 dark:border-neutral-800">
                          <div className="text-2xs text-neutral-500 dark:text-neutral-400">
                            O Cronos utilizará a API v4 do GitLab para listar histórico e comparar versões.
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={testingGitlab || !gitlabProject.trim()}
                            onClick={handleTestGitLab}
                            className="shrink-0 gap-1.5 cursor-pointer text-xs"
                          >
                            {testingGitlab ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Testando Conexão...</span>
                              </>
                            ) : (
                              <>
                                <Server className="w-3.5 h-3.5 text-amber-500" />
                                <span>Testar Conexão GitLab</span>
                              </>
                            )}
                          </Button>
                        </div>

                        {gitlabTestStatus && (
                          <div
                            className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                              gitlabTestStatus.success
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                            }`}
                          >
                            {gitlabTestStatus.success ? (
                              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                            ) : (
                              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                            )}
                            <div className="space-y-0.5 flex-1">
                              <p className="font-semibold">
                                {gitlabTestStatus.success ? 'Conexão validada com sucesso' : 'Falha na conexão com GitLab'}
                              </p>
                              <p className="text-2xs opacity-90">{gitlabTestStatus.message}</p>
                            </div>
                          </div>
                        )}

                        {/* Permissões e Múltiplos Repositórios GitLab */}
                        <GitRepositoryPermissionManager
                          provider="gitlab"
                          token={gitlabToken}
                          gitlabUrl={gitlabInstanceType === 'cloud' ? 'https://gitlab.com' : gitlabUrl}
                          allowedRepositories={allowedRepositories}
                          onChangeAllowedRepositories={setAllowedRepositories}
                          defaultRepoFullName={gitlabProject}
                          onSelectDefaultRepo={(repoFullName) => {
                            setGitlabProject(repoFullName);
                            addToast({
                              title: 'Projeto padrão definido',
                              description: `"${repoFullName}" agora é o projeto principal do GitLab.`,
                              variant: 'success',
                            });
                          }}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Tab 4: Notificações */}
            {activeTab === 'notifications' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Card 4: Notificações do Sistema */}
                <Card className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                        <Bell className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        <span>Notificações do Navegador</span>
                      </CardTitle>
                      {notificationPermission === 'granted' && (
                        <Badge variant="success" className="gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Ativas
                        </Badge>
                      )}
                      {notificationPermission === 'default' && (
                        <Badge variant="outline">Pendente</Badge>
                      )}
                      {notificationPermission === 'denied' && (
                        <Badge variant="destructive" className="gap-1">
                          <BellOff className="w-3 h-3" />
                          Bloqueadas
                        </Badge>
                      )}
                      {notificationPermission === 'unsupported' && (
                        <Badge variant="outline">Não Suportado</Badge>
                      )}
                    </div>
                    <CardDescription className="text-xs text-neutral-500 dark:text-neutral-400">
                      Receba alertas nativos do dispositivo quando as metas de tempo de suas sessões forem atingidas.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850">
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                          {notificationPermission === 'granted'
                            ? 'Alertas em segundo plano habilitados'
                            : notificationPermission === 'denied'
                            ? 'Notificações bloqueadas nas permissões do navegador'
                            : notificationPermission === 'unsupported'
                            ? 'Navegador sem suporte a notificações'
                            : 'Alertas em segundo plano desativados'}
                        </p>
                        <p className="text-2xs text-neutral-500 dark:text-neutral-400">
                          {notificationPermission === 'granted'
                            ? 'Seu navegador está autorizado a emitir notificações do sistema operacional.'
                            : notificationPermission === 'denied'
                            ? 'Para autorizar, acerte as permissões do site na barra de endereços do navegador.'
                            : notificationPermission === 'unsupported'
                            ? 'Este navegador não implementa a API nativa de notificações.'
                            : 'Clique no botão ao lado para autorizar alertas visuais e sonoros de tempo.'}
                        </p>
                      </div>

                      {notificationPermission !== 'denied' && notificationPermission !== 'unsupported' && (
                        <Button
                          type="button"
                          variant={notificationPermission === 'granted' ? 'outline' : 'default'}
                          onClick={handleToggleNotifications}
                          className="shrink-0 gap-1.5 cursor-pointer text-xs"
                        >
                          {notificationPermission === 'granted' ? (
                            <>
                              <BellRing className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>Testar Notificação</span>
                            </>
                          ) : (
                            <>
                              <Bell className="w-3.5 h-3.5" />
                              <span>Ativar Notificações</span>
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Bottom Save Action Button for settings tabs */}
            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={loading}
                className="gap-2 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 shadow-sm text-xs cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{loading ? 'Salvando...' : 'Salvar Alterações'}</span>
              </Button>
            </div>
          </form>
        )}

        {/* Tab 5: Equipe & Convites */}
        {activeTab === 'team' && (
          <div className="animate-in fade-in duration-200">
            <TeamMembersSettingsTab
              currentUser={user}
              tenant={tenant}
              onNavigateToBilling={() => setActiveTab('billing')}
            />
          </div>
        )}

        {/* Tab 6: Plano & Limites de Uso */}
        {activeTab === 'billing' && (
          <div className="animate-in fade-in duration-200">
            <BillingSettingsTab />
          </div>
        )}

        {/* Tab 7: Meus Vínculos */}
        {activeTab === 'linked-clients' && (
          <div className="animate-in fade-in duration-200">
            <LinkedClientsView
              linkedClients={linkedClients}
              userEmail={user?.email || ''}
              loading={loadingLinkedClients}
              onRefresh={onRefreshLinkedClients || (async () => {})}
              onGoToTimer={() => {}}
            />
          </div>
        )}
      </div>
    </div>

      {/* Modal Guia de Tokens e Credenciais Git */}
      <GitCredentialsGuideModal
        open={guideModalOpen}
        onOpenChange={setGuideModalOpen}
        initialTab={guideModalTab}
      />
    </div>
  );
}
