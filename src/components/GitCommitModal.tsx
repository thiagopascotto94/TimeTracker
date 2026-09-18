import React, { useState, useEffect, useMemo } from 'react';
import {
  GitCommit,
  GitBranch,
  Github,
  Sparkles,
  Check,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  ExternalLink,
  Plus,
  Trash2,
  FileCode,
  ArrowLeft,
  Calendar,
  Layers,
  FileText,
  Clock,
  Play,
  RotateCcw,
  Copy,
  Terminal,
  Server,
  BookOpen,
  GitPullRequest,
  Globe,
  HelpCircle,
  FolderGit2,
  ShieldCheck,
  Briefcase,
  Link as LinkIcon,
  X,
} from 'lucide-react';
import { Dialog } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { useToast } from './ui/toast';
import { Tenant, TimeSession, GitCommitItem, SuggestedTaskItem, GitRepositoryItem, Client } from '../types';
import { apiFetch } from '../utils/api';
import { GitCredentialsGuideModal } from './GitCredentialsGuideModal';
import { GitRepositoryPermissionModal } from './GitRepositoryPermissionModal';
import { GitBranchAutocomplete } from './GitBranchAutocomplete';

export interface GitCommitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: Tenant | null;
  activeSession: TimeSession | null;
  sessions: TimeSession[];
  clients?: Client[];
  onTasksCreated: () => Promise<void>;
  onNavigateToSettings?: () => void;
}

interface GitPreset {
  id: string;
  name: string;
  command: string;
  description: string;
  sampleText: string;
}

const GIT_PRESETS: GitPreset[] = [
  {
    id: 'git-log',
    name: 'Git Log',
    command: 'git log -n 5',
    description: 'Histórico completo dos últimos 5 commits com hash, autor, data e mensagens detalhadas.',
    sampleText: `commit a1b2c3d4e5f6g7h8i9j0
Author: dev@empresa.com <dev@empresa.com>
Date:   Tue Sep 15 14:30:00 2026 -0300

    feat(reports): gerar link publico assinado com token unico para aprovacao de faturamento
    - Cria rota /api/reports/share
    - Adiciona validacao de token e visualizacao somente-leitura

commit b2c3d4e5f6g7h8i9j0a1
Author: dev@empresa.com <dev@empresa.com>
Date:   Tue Sep 15 11:15:00 2026 -0300

    fix(timer): impedir finalizacao de sessao sem titulo ou cliente selecionado`,
  },
  {
    id: 'conventional',
    name: 'Conventional Commits',
    command: 'git log -n 10 --pretty=format:"%s"',
    description: 'Lista sucinta e padronizada das mensagens semânticas (feat, fix, refactor, docs...).',
    sampleText: `feat(auth): implementar suporte a autenticacao via GitHub OAuth e tokens PAT
fix(billing): corrigir calculo de arredondamento de minutos nos relatorios em PDF
refactor(database): otimizar consultas da sessao ativa com indices compostos
docs(readme): atualizar instrucoes de configuracao de variaveis de ambiente
test(sessions): adicionar testes unitarios para criacao de tarefas em lote`,
  },
  {
    id: 'git-oneline',
    name: 'Git Oneline',
    command: 'git log -n 5 --oneline',
    description: 'Lista rápida com hash curto de 7 caracteres e título de cada commit.',
    sampleText: `a1b2c3d feat(reports): gerar link publico assinado para aprovacao de faturamento
b2c3d4e fix(timer): impedir finalizacao de sessao sem cliente selecionado
c3d4e5f refactor(tasks): migrar criacao em lote para transacao atomica
d4e5f6g test(billing): adicionar cobertura de testes para arredondamento
e5f6g7h chore: atualizar dependencias de seguranca`,
  },
  {
    id: 'git-diff',
    name: 'Git Diff (Patch)',
    command: 'git diff HEAD~1 HEAD --stat -p',
    description: 'Resumo estatístico de arquivos modificados e o patch detalhado do último commit.',
    sampleText: ` src/controllers/reports.ts | 42 +++++++++++++++++++++++++++++++++++++++++-
 src/routes/api.ts          | 12 ++++++++++--
 2 files changed, 51 insertions(+), 3 deletions(-)

diff --git a/src/controllers/reports.ts b/src/controllers/reports.ts
index 1a2b3c4..5d6e7f8 100644
--- a/src/controllers/reports.ts
+++ b/src/controllers/reports.ts
@@ -15,6 +15,20 @@ export async function generateReport(req, res) {
+  // Adicionado suporte a exportacao de faturas com calculo automatico
+  const rate = user.default_hourly_rate;
+  const total = (session.duration_minutes / 60) * rate;`,
  },
];

export function GitCommitModal({
  open,
  onOpenChange,
  tenant,
  activeSession,
  sessions,
  clients,
  onTasksCreated,
  onNavigateToSettings,
}: GitCommitModalProps) {
  const { addToast } = useToast();

  // Active session client context & project isolation
  const activeSessionClientId = activeSession?.client_id || (activeSession as any)?.Client?.id || null;
  const [selectedClientId, setSelectedClientId] = useState<string | null>(activeSessionClientId || null);
  const [showAllWorkspaceRepos, setShowAllWorkspaceRepos] = useState(false);

  const currentClient = useMemo(() => {
    if (!clients || !selectedClientId) return null;
    return clients.find((c) => c.id === selectedClientId) || null;
  }, [clients, selectedClientId]);

  // Wizard Step: 'input' -> 'approval' (Review & Edit suggested tasks)
  const [step, setStep] = useState<'input' | 'approval'>('input');
  const [activeInputTab, setActiveInputTab] = useState<'manual' | 'github'>('manual');

  // Manual Diff / Log with Terminal Command Presets
  const [selectedPresetId, setSelectedPresetId] = useState<string>('git-log');
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [manualText, setManualText] = useState('');

  // Provider & API Fetch state (GitHub & GitLab / Self-Hosted)
  const [repoProvider, setRepoProvider] = useState<'github' | 'gitlab'>('github');

  // Option 1B: GitHub API Fetch
  const [githubRepo, setGithubRepo] = useState(tenant?.github_repo || '');
  const [githubBranch, setGithubBranch] = useState('main');
  const [githubToken, setGithubToken] = useState(tenant?.github_token || '');

  // Option 1B: GitLab API Fetch (Cloud or Self-Hosted)
  const [gitlabProject, setGitlabProject] = useState(tenant?.gitlab_project || '');
  const [gitlabUrl, setGitlabUrl] = useState(tenant?.gitlab_url || 'https://gitlab.com');
  const [gitlabBranch, setGitlabBranch] = useState('main');
  const [gitlabToken, setGitlabToken] = useState(tenant?.gitlab_token || '');

  // Multi-repository & Permissions state
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
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);

  // Client-isolated repositories
  const clientRepositories = useMemo(() => {
    if (!currentClient) return [];
    let repos: GitRepositoryItem[] = [];
    if (currentClient.allowed_repositories) {
      try {
        const parsed = JSON.parse(currentClient.allowed_repositories);
        if (Array.isArray(parsed)) repos = [...parsed];
      } catch {}
    }
    // Also include the client's direct github_repo or gitlab_project if not in the list
    if (currentClient.git_provider === 'gitlab' || (!currentClient.git_provider && currentClient.gitlab_project)) {
      if (
        currentClient.gitlab_project &&
        !repos.some((r) => r.fullName.toLowerCase() === currentClient.gitlab_project?.toLowerCase())
      ) {
        repos.unshift({
          id: `gitlab:${currentClient.gitlab_project}`,
          provider: 'gitlab',
          fullName: currentClient.gitlab_project,
          name: currentClient.gitlab_project.split('/').pop() || currentClient.gitlab_project,
          defaultBranch: 'main',
          gitlabUrl: currentClient.gitlab_url || undefined,
        });
      }
    } else if (currentClient.github_repo) {
      if (
        !repos.some((r) => r.fullName.toLowerCase() === currentClient.github_repo?.toLowerCase())
      ) {
        repos.unshift({
          id: `github:${currentClient.github_repo}`,
          provider: 'github',
          fullName: currentClient.github_repo,
          name: currentClient.github_repo.split('/').pop() || currentClient.github_repo,
          defaultBranch: 'main',
        });
      }
    }
    return repos;
  }, [currentClient]);

  // Filtered repositories to display based on client context
  const displayedRepositories = useMemo(() => {
    if (currentClient && !showAllWorkspaceRepos) {
      return clientRepositories.filter((r) => r.provider === repoProvider);
    }
    return allowedRepositories.filter((r) => r.provider === repoProvider);
  }, [currentClient, showAllWorkspaceRepos, clientRepositories, allowedRepositories, repoProvider]);

  // Guide Modal State
  const [guideModalOpen, setGuideModalOpen] = useState(false);
  const [guideModalTab, setGuideModalTab] = useState<'github' | 'gitlab' | 'selfhosted' | 'terminal'>('github');

  const [loadingCommits, setLoadingCommits] = useState(false);
  const [commits, setCommits] = useState<GitCommitItem[]>([]);
  const [commitFilter, setCommitFilter] = useState('');
  const [selectedCommitShas, setSelectedCommitShas] = useState<Set<string>>(new Set());

  // AI Extraction State
  const [analyzingWithAI, setAnalyzingWithAI] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [suggestedTasks, setSuggestedTasks] = useState<SuggestedTaskItem[]>([]);

  // Approval / Target Session State
  const [targetMode, setTargetMode] = useState<'active' | 'existing' | 'new'>(
    activeSession ? 'active' : 'new'
  );
  const [selectedExistingSessionId, setSelectedExistingSessionId] = useState<string>('');
  const [newSessionTitle, setNewSessionTitle] = useState('Sessão - Entregas de Commits');
  const [savingTasks, setSavingTasks] = useState(false);

  // Selected Preset for Manual Tab
  const currentPreset = GIT_PRESETS.find((p) => p.id === selectedPresetId) || GIT_PRESETS[0];

  const handleCopyCommand = async (cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedCommand(true);
      setTimeout(() => setCopiedCommand(false), 2000);
      addToast({
        title: 'Comando Git copiado!',
        description: 'Cole no terminal do seu projeto e traga o resultado de volta para cá.',
        variant: 'success',
      });
    } catch {
      addToast({
        title: 'Falha ao copiar',
        description: 'Não foi possível acessar a área de transferência do navegador.',
        variant: 'destructive',
      });
    }
  };

  const handleSelectPreset = (preset: GitPreset) => {
    setSelectedPresetId(preset.id);
    setManualText(preset.sampleText);
    addToast({
      title: `Exemplo carregado: ${preset.name}`,
      description: 'Texto de exemplo preenchido. O comando do terminal correspondente está pronto para copiar abaixo.',
      variant: 'default',
    });
  };

  // Switch client context and update Git provider/repo inputs
  const handleClientChange = (newClientId: string) => {
    setSelectedClientId(newClientId || null);
    setShowAllWorkspaceRepos(false);

    if (!newClientId) {
      if (tenant?.git_provider) setRepoProvider(tenant.git_provider);
      if (tenant?.github_repo) setGithubRepo(tenant.github_repo);
      if (tenant?.github_token) setGithubToken(tenant.github_token);
      if (tenant?.gitlab_project) setGitlabProject(tenant.gitlab_project);
      if (tenant?.gitlab_url) setGitlabUrl(tenant.gitlab_url);
      if (tenant?.gitlab_token) setGitlabToken(tenant.gitlab_token);
      return;
    }

    const c = clients?.find((cl) => cl.id === newClientId);
    if (c) {
      if (c.git_provider) {
        setRepoProvider(c.git_provider);
      } else if (c.gitlab_project && !c.github_repo) {
        setRepoProvider('gitlab');
      }

      if (c.github_repo) setGithubRepo(c.github_repo);
      else if (tenant?.github_repo) setGithubRepo(tenant.github_repo);

      if (c.github_token) setGithubToken(c.github_token);
      else if (tenant?.github_token) setGithubToken(tenant.github_token);

      if (c.gitlab_project) setGitlabProject(c.gitlab_project);
      else if (tenant?.gitlab_project) setGitlabProject(tenant.gitlab_project);

      if (c.gitlab_url) setGitlabUrl(c.gitlab_url);
      else if (tenant?.gitlab_url) setGitlabUrl(tenant.gitlab_url);

      if (c.gitlab_token) setGitlabToken(c.gitlab_token);
      else if (tenant?.gitlab_token) setGitlabToken(tenant.gitlab_token);

      // Check if client has repos and prefill first if empty
      let cRepos: GitRepositoryItem[] = [];
      if (c.allowed_repositories) {
        try {
          const parsed = JSON.parse(c.allowed_repositories);
          if (Array.isArray(parsed)) cRepos = parsed;
        } catch {}
      }
      if (cRepos.length > 0 && !c.github_repo && !c.gitlab_project) {
        const first = cRepos[0];
        if (first.provider === 'github') {
          setRepoProvider('github');
          setGithubRepo(first.fullName);
        } else {
          setRepoProvider('gitlab');
          setGitlabProject(first.fullName);
        }
      }
    }
  };

  // Sync with client & tenant whenever modal opens
  useEffect(() => {
    if (open) {
      const activeClientId = activeSession?.client_id || (activeSession as any)?.Client?.id || null;
      setSelectedClientId(activeClientId);
      setShowAllWorkspaceRepos(false);

      const targetClient = clients?.find((c) => c.id === activeClientId);
      if (targetClient) {
        if (targetClient.git_provider) {
          setRepoProvider(targetClient.git_provider);
        } else if (targetClient.gitlab_project && !targetClient.github_repo) {
          setRepoProvider('gitlab');
        } else if (tenant?.git_provider) {
          setRepoProvider(tenant.git_provider);
        }

        if (targetClient.github_repo) {
          setGithubRepo(targetClient.github_repo);
        } else if (tenant?.github_repo) {
          setGithubRepo(tenant.github_repo);
        }

        if (targetClient.github_token) {
          setGithubToken(targetClient.github_token);
        } else if (tenant?.github_token) {
          setGithubToken(tenant.github_token);
        }

        if (targetClient.gitlab_project) {
          setGitlabProject(targetClient.gitlab_project);
        } else if (tenant?.gitlab_project) {
          setGitlabProject(tenant.gitlab_project);
        }

        if (targetClient.gitlab_url) {
          setGitlabUrl(targetClient.gitlab_url);
        } else if (tenant?.gitlab_url) {
          setGitlabUrl(tenant.gitlab_url);
        }

        if (targetClient.gitlab_token) {
          setGitlabToken(targetClient.gitlab_token);
        } else if (tenant?.gitlab_token) {
          setGitlabToken(tenant.gitlab_token);
        }

        if (targetClient.github_repo || targetClient.gitlab_project) {
          setActiveInputTab('github');
        }
      } else {
        if (tenant?.git_provider) setRepoProvider(tenant.git_provider);
        if (tenant?.github_repo) setGithubRepo(tenant.github_repo);
        if (tenant?.github_token) setGithubToken(tenant.github_token);
        if (tenant?.gitlab_project) setGitlabProject(tenant.gitlab_project);
        if (tenant?.gitlab_url) setGitlabUrl(tenant.gitlab_url);
        if (tenant?.gitlab_token) setGitlabToken(tenant.gitlab_token);
        if ((tenant?.github_repo || tenant?.gitlab_project) && !manualText.trim()) {
          setActiveInputTab('github');
        }
      }

      if (tenant?.allowed_repositories) {
        try {
          const parsed = JSON.parse(tenant.allowed_repositories);
          setAllowedRepositories(Array.isArray(parsed) ? parsed : []);
        } catch {
          setAllowedRepositories([]);
        }
      }

      setTargetMode(activeSession ? 'active' : 'new');
    }
  }, [open, tenant, activeSession, clients]);

  // Handle Fetch Commits from GitHub or GitLab (Option 1B)
  const handleFetchCommits = async () => {
    setLoadingCommits(true);
    try {
      let bodyPayload: any;

      if (repoProvider === 'gitlab') {
        if (!gitlabProject.trim()) {
          addToast({
            title: 'Projeto não informado',
            description: 'Informe o projeto do GitLab no formato "grupo/projeto", ID ou URL.',
            variant: 'destructive',
          });
          setLoadingCommits(false);
          return;
        }
        bodyPayload = {
          provider: 'gitlab',
          project: gitlabProject.trim(),
          gitlabUrl: gitlabUrl.trim() || undefined,
          branch: gitlabBranch.trim() || 'main',
          token: gitlabToken.trim() || undefined,
          client_id: selectedClientId || undefined,
          per_page: 20,
        };
      } else {
        if (!githubRepo.trim()) {
          addToast({
            title: 'Repositório não informado',
            description: 'Informe o repositório no formato "dono/projeto" ou a URL do GitHub.',
            variant: 'destructive',
          });
          setLoadingCommits(false);
          return;
        }
        bodyPayload = {
          provider: 'github',
          repo: githubRepo.trim(),
          branch: githubBranch.trim() || 'main',
          token: githubToken.trim() || undefined,
          client_id: selectedClientId || undefined,
          per_page: 20,
        };
      }

      const res = await apiFetch('/api/git/commits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao carregar commits do repositório');
      }

      const list: GitCommitItem[] = data.commits || [];
      setCommits(list);

      // By default, leave all commits unselected
      setSelectedCommitShas(new Set());

      addToast({
        title: 'Commits carregados',
        description: `${list.length} commits encontrados no repositório ${data.repo}.`,
        variant: 'success',
      });
    } catch (err: any) {
      addToast({
        title: 'Falha ao buscar commits',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoadingCommits(false);
    }
  };

  // Toggle commit selection
  const toggleCommitSelection = (sha: string) => {
    setSelectedCommitShas((prev) => {
      const next = new Set(prev);
      if (next.has(sha)) {
        next.delete(sha);
      } else {
        next.add(sha);
      }
      return next;
    });
  };

  const selectAllCommits = (select: boolean) => {
    if (select) {
      const allShas = new Set(filteredCommits.map((c) => c.sha));
      setSelectedCommitShas(allShas);
    } else {
      setSelectedCommitShas(new Set());
    }
  };

  const filteredCommits = commits.filter((c) => {
    if (!commitFilter.trim()) return true;
    const q = commitFilter.toLowerCase();
    return (
      c.message.toLowerCase().includes(q) ||
      c.author.toLowerCase().includes(q) ||
      c.shortSha.toLowerCase().includes(q)
    );
  });

  // Run AI Analysis
  const handleAnalyzeWithAI = async () => {
    let payload: any = {};

    if (activeInputTab === 'manual') {
      if (!manualText.trim()) {
        addToast({
          title: 'Texto vazio',
          description: 'Cole ao menos uma mensagem de commit, diff ou log para análise.',
          variant: 'destructive',
        });
        return;
      }
      payload = { rawText: manualText.trim() };
    } else {
      // Option 1B: GitHub Selected Commits
      const selected = commits.filter((c) => selectedCommitShas.has(c.sha));
      if (selected.length === 0) {
        addToast({
          title: 'Nenhum commit selecionado',
          description: 'Selecione ao menos um commit da lista para enviar à IA.',
          variant: 'destructive',
        });
        return;
      }
      payload = {
        commits: selected.map((c) => ({
          sha: c.sha,
          message: c.message,
          author: c.author,
          date: c.date,
          url: c.url,
        })),
      };
    }

    setAnalyzingWithAI(true);
    try {
      const res = await apiFetch('/api/ai/suggest-tasks-from-git', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao analisar commits com IA');
      }

      setAiSummary(data.summary || 'Tarefas sugeridas com base nas alterações de código.');
      setSuggestedTasks(data.tasks || []);
      setStep('approval');

      addToast({
        title: 'Sugestões Geradas!',
        description: `${data.tasks?.length || 0} tarefas extraídas. Revise e aprove antes de salvar.`,
        variant: 'success',
      });
    } catch (err: any) {
      addToast({
        title: 'Erro na análise de IA',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setAnalyzingWithAI(false);
    }
  };

  // Direct import of commits without AI if user wants to import them as-is
  const handleDirectImportCommits = () => {
    const selected = commits.filter((c) => selectedCommitShas.has(c.sha));
    if (selected.length === 0) {
      addToast({
        title: 'Nenhum commit selecionado',
        description: 'Selecione ao menos um commit da lista para importar diretamente.',
        variant: 'destructive',
      });
      return;
    }

    const tasksFromCommits: SuggestedTaskItem[] = selected.map((c) => {
      const lines = (c.message || '').split('\n').map((l) => l.trim()).filter(Boolean);
      const firstLine = lines[0] || `Commit ${c.sha.slice(0, 7)}`;
      const rest = lines.slice(1).join('\n');
      const authorInfo = c.author ? `Autor: ${c.author}` : '';
      const notesCombined = [authorInfo, rest].filter(Boolean).join(' | ');

      return {
        id: crypto.randomUUID(),
        description: firstLine,
        notes: notesCombined,
        link: c.url || null,
        selected: true,
      };
    });

    setAiSummary(`${selected.length} commit(s) selecionado(s) diretamente para importação.`);
    setSuggestedTasks(tasksFromCommits);
    setStep('approval');
    addToast({
      title: 'Commits Carregados',
      description: `${tasksFromCommits.length} tarefa(s) pronta(s) com links dos commits. Revise e confirme.`,
      variant: 'default',
    });
  };

  // Toggle single suggested task
  const toggleTaskSelected = (id: string) => {
    setSuggestedTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t))
    );
  };

  // Update task description, notes or link inline
  const updateTaskField = (id: string, field: 'description' | 'notes' | 'link', value: string) => {
    setSuggestedTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  // Delete single task from list
  const deleteTask = (id: string) => {
    setSuggestedTasks((prev) => prev.filter((t) => t.id !== id));
  };

  // Add a new blank task to the review list
  const addNewTask = () => {
    setSuggestedTasks((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        description: '',
        notes: '',
        link: null,
        selected: true,
      },
    ]);
  };

  // Approve and persist tasks
  const handleApproveAndSave = async () => {
    const approvedTasks = suggestedTasks.filter(
      (t) => t.selected && t.description.trim().length > 0
    );

    if (approvedTasks.length === 0) {
      addToast({
        title: 'Nenhuma tarefa selecionada',
        description: 'Marque ao menos uma tarefa com título preenchido para salvar.',
        variant: 'destructive',
      });
      return;
    }

    setSavingTasks(true);
    try {
      let targetSessionId = '';

      if (targetMode === 'active') {
        if (!activeSession) {
          throw new Error('Não há sessão ativa em andamento.');
        }
        targetSessionId = activeSession.id;
      } else if (targetMode === 'existing') {
        if (!selectedExistingSessionId) {
          throw new Error('Selecione uma sessão existente para receber as tarefas.');
        }
        targetSessionId = selectedExistingSessionId;
      } else if (targetMode === 'new') {
        // Create new session first
        const sessionRes = await apiFetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: newSessionTitle.trim() || 'Sessão de Entregas de Commits',
            notes: aiSummary ? `Origem: Análise de commits de código. ${aiSummary}` : 'Origem: Commits Git',
          }),
        });

        if (!sessionRes.ok) {
          const errData = await sessionRes.json();
          throw new Error(errData.error || 'Erro ao criar nova sessão');
        }

        const sessionData = await sessionRes.json();
        targetSessionId = sessionData.session.id;
      }

      // Add tasks in batch
      const batchRes = await apiFetch('/api/tasks/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          time_session_id: targetSessionId,
          tasks: approvedTasks.map((t) => ({
            description: t.description.trim(),
            notes: t.notes ? t.notes.trim() : null,
            link: t.link ? t.link.trim() : null,
          })),
        }),
      });

      if (!batchRes.ok) {
        const errData = await batchRes.json();
        throw new Error(errData.error || 'Erro ao criar tarefas na sessão');
      }

      await onTasksCreated();

      addToast({
        title: 'Tarefas Aprovadas e Criadas!',
        description: `${approvedTasks.length} tarefa(s) adicionada(s) à sessão com sucesso.`,
        variant: 'success',
      });

      // Close modal and reset
      onOpenChange(false);
      setStep('input');
      setSuggestedTasks([]);
    } catch (err: any) {
      addToast({
        title: 'Falha ao salvar tarefas',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSavingTasks(false);
    }
  };

  const selectedTasksCount = suggestedTasks.filter(
    (t) => t.selected && t.description.trim().length > 0
  ).length;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Extrair Tarefas a partir de Commits do Git"
      description="Analise alterações de código com IA e aprove tarefas estruturadas para o faturamento."
      className="w-full sm:max-w-3xl flex flex-col p-4 sm:p-6 max-h-[92vh] overflow-y-auto"
    >
      <div className="space-y-6">
        {/* Step Indicator Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2.5 text-xs">
            <span
              className={`px-3 py-1.5 rounded-full font-semibold ${
                step === 'input'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
              }`}
            >
              1. Commits
            </span>
            <span className="text-neutral-300 dark:text-neutral-700">→</span>
            <span
              className={`px-3 py-1.5 rounded-full font-semibold ${
                step === 'approval'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
              }`}
            >
              2. Aprovação
            </span>
          </div>

          {step === 'approval' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStep('input')}
              className="h-9 sm:h-8 text-xs gap-1.5 cursor-pointer w-full sm:w-auto"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar aos Commits</span>
            </Button>
          )}
        </div>

        {/* STEP 1: INPUT VIEW (1A: Manual or 1B: GitHub) */}
        {step === 'input' && (
          <div className="space-y-6">
            {/* Tabs for Manual vs GitHub */}
            <div className="grid grid-cols-2 gap-1.5 p-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveInputTab('manual')}
                className={`py-2.5 px-3 rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeInputTab === 'manual'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
              >
                <FileCode className="w-4 h-4 text-amber-500" />
                <span>Diff Manual</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveInputTab('github')}
                className={`py-2.5 px-3 rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeInputTab === 'github'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
              >
                <GitPullRequest className="w-4 h-4 text-indigo-500" />
                <span>Integrações</span>
              </button>
            </div>

            {/* TAB: MANUAL INPUT */}
            {activeInputTab === 'manual' && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Cole as mensagens de commit, git log ou git diff:
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5 text-2xs">
                    <span className="text-neutral-400">Exemplos rápidos:</span>
                    {GIT_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPreset(preset)}
                        className={`px-2.5 py-1 rounded transition cursor-pointer font-medium ${
                          selectedPresetId === preset.id
                            ? 'bg-indigo-600 text-white font-semibold shadow-2xs'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                        }`}
                        title={`Carregar exemplo e ver comando: ${preset.command}`}
                      >
                        {preset.name}
                      </button>
                    ))}
                    {manualText && (
                      <button
                        type="button"
                        onClick={() => setManualText('')}
                        className="text-neutral-400 hover:text-rose-500 transition cursor-pointer ml-1 font-medium"
                        title="Limpar campo de texto"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                </div>

                {/* Git Terminal Command for Selected Preset with Copy Button */}
                <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-900 text-neutral-100 p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-2xs text-neutral-400">
                    <span className="flex items-center gap-1.5 font-semibold text-neutral-200">
                      <Terminal className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Comando para obter esta informação no seu terminal Git:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setGuideModalTab('terminal');
                        setGuideModalOpen(true);
                      }}
                      className="text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1 text-2xs cursor-pointer font-medium"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Guia de Comandos Git</span>
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2 bg-neutral-950 px-3.5 py-2.5 rounded-lg font-mono text-xs border border-neutral-800">
                    <code className="text-emerald-400 font-semibold truncate select-all">
                      $ {currentPreset.command}
                    </code>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopyCommand(currentPreset.command)}
                      className="h-8 px-3 text-2xs gap-1.5 text-neutral-200 hover:text-white hover:bg-neutral-800 cursor-pointer shrink-0 border border-neutral-700/60 bg-neutral-900/50"
                      title="Copiar comando git para a área de transferência"
                    >
                      {copiedCommand ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span className="text-emerald-400 font-semibold">Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-neutral-400" />
                          <span>Copiar Comando</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <textarea
                  rows={7}
                  placeholder={`Cole aqui o resultado de "${currentPreset.command}" ou as mensagens de commit...`}
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  className="w-full text-xs p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />

                <div className="flex flex-col gap-1 text-2xs text-neutral-500 dark:text-neutral-400">
                  <span>{manualText.length} caracteres</span>
                  <span>Universal: aceita qualquer formato de log, convenção semântica ou patch diff.</span>
                </div>
              </div>
            )}

            {/* TAB: REPOSITORY API INTEGRATION (GitHub & GitLab / Self-Hosted) */}
            {activeInputTab === 'github' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850 space-y-3.5">
                  {/* Provider Switcher & Help Guide Button */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200/70 dark:border-neutral-800/70 pb-2">
                    <div className="inline-flex rounded-lg bg-neutral-200/70 dark:bg-neutral-800 p-0.5 text-2xs font-medium">
                      <button
                        type="button"
                        onClick={() => setRepoProvider('github')}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-2xs transition cursor-pointer ${
                          repoProvider === 'github'
                            ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 font-semibold shadow-2xs'
                            : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
                        }`}
                      >
                        <Github className="w-3 h-3" />
                        <span>GitHub</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRepoProvider('gitlab')}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-2xs transition cursor-pointer ${
                          repoProvider === 'gitlab'
                            ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 font-semibold shadow-2xs'
                            : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
                        }`}
                      >
                        <GitPullRequest className="w-3 h-3 text-orange-500" />
                        <span>GitLab / Self-Hosted</span>
                      </button>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setGuideModalTab(repoProvider === 'gitlab' ? 'gitlab' : 'github');
                        setGuideModalOpen(true);
                      }}
                      className="h-6.5 text-2xs gap-1.5 cursor-pointer text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/30"
                    >
                      <BookOpen className="w-3 h-3" />
                      <span>Guia de Tokens &amp; Projetos</span>
                    </Button>
                  </div>

                  {/* Multi-repository Quick Selector Bar with Client Isolation */}
                  <div className="p-2.5 rounded-lg border border-indigo-100 dark:border-indigo-950 bg-white dark:bg-neutral-900 space-y-2">
                    {/* Client Scope Filter */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-neutral-100 dark:border-neutral-800">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 w-full sm:w-auto">
                        <div className="flex items-center gap-1.5">
                          <Briefcase className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                          <span className="text-2xs font-semibold text-neutral-700 dark:text-neutral-300">Cliente / Foco:</span>
                        </div>
                        <select
                          value={selectedClientId || ''}
                          onChange={(e) => handleClientChange(e.target.value)}
                          className="text-2xs py-1 px-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-850 text-neutral-900 dark:text-neutral-100 font-medium focus:ring-1 focus:ring-indigo-500 cursor-pointer w-full sm:max-w-[260px] truncate h-7"
                        >
                          <option value="">Todos os Repositórios (Workspace Geral)</option>
                          {clients && clients.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} {activeSessionClientId === c.id ? '★ (Sessão Atual)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {currentClient && (
                        <div className="flex items-center gap-1.5">
                          <Badge className="bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-2xs py-0.5 px-2 font-medium">
                            {activeSessionClientId === currentClient.id ? 'Foco da Sessão' : 'Cliente Selecionado'}: {currentClient.name}
                          </Badge>
                          <button
                            type="button"
                            onClick={() => setShowAllWorkspaceRepos(!showAllWorkspaceRepos)}
                            className="text-2xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                          >
                            {showAllWorkspaceRepos ? 'Ver apenas do cliente' : 'Ver todos do workspace'}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-2xs font-semibold text-neutral-800 dark:text-neutral-200">
                        <FolderGit2 className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                        <span>
                          {currentClient && !showAllWorkspaceRepos
                            ? `Repositórios de ${currentClient.name} (${displayedRepositories.length})`
                            : `Repositórios Autorizados (${displayedRepositories.length})`}
                        </span>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPermissionModalOpen(true)}
                        className="h-6 px-2 text-2xs gap-1 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 cursor-pointer"
                      >
                        <ShieldCheck className="w-3 h-3" />
                        <span>{currentClient && !showAllWorkspaceRepos ? `Gerenciar (${currentClient.name})` : 'Gerenciar Permissões'}</span>
                      </Button>
                    </div>

                    {displayedRepositories.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {displayedRepositories.map((repo) => {
                          const isCurrent =
                            repoProvider === 'github'
                              ? githubRepo.toLowerCase() === repo.fullName.toLowerCase()
                              : gitlabProject.toLowerCase() === repo.fullName.toLowerCase();

                          return (
                            <button
                              key={repo.id || repo.fullName}
                              type="button"
                              onClick={() => {
                                if (repoProvider === 'github') {
                                  setGithubRepo(repo.fullName);
                                  if (repo.defaultBranch) setGithubBranch(repo.defaultBranch);
                                } else {
                                  setGitlabProject(repo.fullName);
                                  if (repo.gitlabUrl) setGitlabUrl(repo.gitlabUrl);
                                  if (repo.defaultBranch) setGitlabBranch(repo.defaultBranch);
                                }
                                addToast({
                                  title: 'Repositório selecionado',
                                  description: `"${repo.fullName}" preenchido para busca de commits.`,
                                  variant: 'default',
                                });
                              }}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-2xs transition-all cursor-pointer border ${
                                isCurrent
                                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 font-bold shadow-2xs'
                                  : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700'
                              }`}
                            >
                              {isCurrent && <Check className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />}
                              <span>{repo.fullName}</span>
                              {repo.defaultBranch && (
                                <span className="text-2xs opacity-75 font-mono">({repo.defaultBranch})</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-2xs text-neutral-500 py-1 bg-neutral-50 dark:bg-neutral-850/60 p-2 rounded-md">
                        <span>
                          {currentClient && !showAllWorkspaceRepos
                            ? `Nenhum repositório ${repoProvider === 'gitlab' ? 'GitLab' : 'GitHub'} vinculado ao cliente "${currentClient.name}".`
                            : `Nenhum repositório ${repoProvider === 'gitlab' ? 'GitLab' : 'GitHub'} selecionado nas permissões do workspace.`}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPermissionModalOpen(true)}
                          className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer shrink-0 text-2xs"
                        >
                          + {currentClient && !showAllWorkspaceRepos ? `Autorizar para ${currentClient.name}` : 'Descobrir e Autorizar'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Provider Form Fields: GitHub */}
                  {repoProvider === 'github' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-2xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                          <Github className="w-3 h-3" />
                          <span>Repositório GitHub (dono/projeto ou URL)</span>
                        </label>
                        <Input
                          type="text"
                          placeholder="ex: facebook/react ou usuario/app"
                          value={githubRepo}
                          onChange={(e) => setGithubRepo(e.target.value)}
                          className="h-7.5 text-2xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-2xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                          <GitBranch className="w-3 h-3 text-indigo-500" />
                          <span>Branch / SHA</span>
                        </label>
                        <GitBranchAutocomplete
                          value={githubBranch}
                          onChange={setGithubBranch}
                          repo={githubRepo}
                          provider="github"
                          token={githubToken}
                          clientId={selectedClientId}
                          placeholder="main ou selecione branch..."
                        />
                      </div>
                    </div>
                  )}

                  {/* Provider Form Fields: GitLab / Self-Hosted */}
                  {repoProvider === 'gitlab' && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="sm:col-span-2 space-y-1">
                          <label className="text-2xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                            <Server className="w-3 h-3 text-orange-500" />
                            <span>URL da Instância GitLab</span>
                          </label>
                          <Input
                            type="url"
                            placeholder="https://gitlab.com ou https://gitlab.suaempresa.com"
                            value={gitlabUrl}
                            onChange={(e) => setGitlabUrl(e.target.value)}
                            className="h-7.5 text-2xs"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-2xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                            <GitBranch className="w-3 h-3 text-orange-500" />
                            <span>Branch</span>
                          </label>
                          <GitBranchAutocomplete
                            value={gitlabBranch}
                            onChange={setGitlabBranch}
                            repo={gitlabProject}
                            provider="gitlab"
                            token={gitlabToken}
                            gitlabUrl={gitlabUrl}
                            clientId={selectedClientId}
                            placeholder="main ou selecione branch..."
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-2xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                          <GitPullRequest className="w-3 h-3 text-orange-500" />
                          <span>Projeto GitLab (caminho com grupo, ID numérico ou URL)</span>
                        </label>
                        <Input
                          type="text"
                          placeholder="ex: grupo/projeto ou 12345678"
                          value={gitlabProject}
                          onChange={(e) => setGitlabProject(e.target.value)}
                          className="h-7.5 text-2xs"
                        />
                      </div>
                    </div>
                  )}

                  {/* Token Status & Action */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-neutral-200/50 dark:border-neutral-800/50">
                    <div className="text-2xs text-neutral-500 dark:text-neutral-400">
                      {repoProvider === 'github' ? (
                        githubToken ? (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium text-2xs">
                            <CheckCircle2 className="w-3 h-3" />
                            PAT do GitHub configurado
                          </span>
                        ) : (
                          <span className="text-2xs">
                            Sem token salvo.{' '}
                            {onNavigateToSettings && (
                              <button
                                type="button"
                                onClick={() => {
                                  onOpenChange(false);
                                  onNavigateToSettings();
                                }}
                                className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer font-medium text-2xs"
                              >
                                Configurar em Configurações
                              </button>
                            )}
                          </span>
                        )
                      ) : gitlabToken ? (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium text-2xs">
                          <CheckCircle2 className="w-3 h-3" />
                          PAT do GitLab configurado
                        </span>
                      ) : (
                        <span className="text-2xs">
                          Sem token salvo.{' '}
                          {onNavigateToSettings && (
                            <button
                              type="button"
                              onClick={() => {
                                onOpenChange(false);
                                onNavigateToSettings();
                              }}
                              className="text-orange-600 dark:text-orange-400 hover:underline cursor-pointer font-medium text-2xs"
                            >
                              Configurar em Configurações
                            </button>
                          )}
                        </span>
                      )}
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      disabled={
                        loadingCommits ||
                        (repoProvider === 'github' && !githubRepo.trim()) ||
                        (repoProvider === 'gitlab' && !gitlabProject.trim())
                      }
                      onClick={handleFetchCommits}
                      className="h-7.5 text-2xs gap-1.5 cursor-pointer bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 shrink-0 font-medium"
                    >
                      {loadingCommits ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Buscando...</span>
                        </>
                      ) : (
                        <>
                          <Search className="w-3.5 h-3.5" />
                          <span>Buscar Commits</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Commits List (if loaded) */}
                {commits.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="relative flex-1 max-w-xs">
                        <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2" />
                        <Input
                          type="text"
                          placeholder="Filtrar commits..."
                          value={commitFilter}
                          onChange={(e) => setCommitFilter(e.target.value)}
                          className="h-7 text-2xs pl-8"
                        />
                      </div>

                      <div className="flex items-center gap-2 text-2xs">
                        <span className="text-neutral-500">
                          {selectedCommitShas.size} de {filteredCommits.length} selecionado(s)
                        </span>
                        <button
                          type="button"
                          onClick={() => selectAllCommits(true)}
                          className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                          Marcar todos
                        </button>
                        <span>|</span>
                        <button
                          type="button"
                          onClick={() => selectAllCommits(false)}
                          className="text-neutral-500 hover:underline cursor-pointer"
                        >
                          Desmarcar
                        </button>
                      </div>
                    </div>

                    <div className="max-h-60 overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-100 dark:divide-neutral-800 bg-white dark:bg-neutral-900">
                      {filteredCommits.map((c) => {
                        const isSelected = selectedCommitShas.has(c.sha);
                        return (
                          <div
                            key={c.sha}
                            onClick={() => toggleCommitSelection(c.sha)}
                            className={`p-2 text-2xs flex items-start gap-2.5 transition-colors cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-850 ${
                              isSelected ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : ''
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleCommitSelection(c.sha)}
                              className="mt-0.5 rounded text-indigo-600 cursor-pointer"
                            />
                            <div className="flex-1 min-w-0 space-y-0.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                                  {c.message.split('\n')[0]}
                                </span>
                                <span className="font-mono text-2xs text-neutral-400 shrink-0 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                                  {c.shortSha}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-2xs text-neutral-500 dark:text-neutral-400">
                                <span>{c.author}</span>
                                <span>•</span>
                                <span>{c.date ? new Date(c.date).toLocaleDateString('pt-BR') : ''}</span>
                                {c.url && (
                                  <a
                                    href={c.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="hover:text-indigo-600 flex items-center gap-0.5 ml-auto text-neutral-400"
                                  >
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Bottom Actions for Step 1 */}
            <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-2xs text-neutral-500 dark:text-neutral-400">
                {activeInputTab === 'github' && selectedCommitShas.size > 0
                  ? `${selectedCommitShas.size} commit(s) selecionado(s) com URL de rastreamento do repositório.`
                  : 'A IA analisará o código e gerará sugestões para sua aprovação antes de qualquer inserção no banco.'}
              </span>

              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                {activeInputTab === 'github' && selectedCommitShas.size > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={analyzingWithAI || selectedCommitShas.size === 0}
                    onClick={handleDirectImportCommits}
                    className="gap-1.5 text-xs border-neutral-300 dark:border-neutral-700 cursor-pointer h-9 px-3"
                    title="Importar mensagens dos commits selecionados diretamente como tarefas com o link completo"
                  >
                    <GitCommit className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Importar Direto ({selectedCommitShas.size})</span>
                  </Button>
                )}

                <Button
                  type="button"
                  disabled={
                    analyzingWithAI ||
                    (activeInputTab === 'manual' && !manualText.trim()) ||
                    (activeInputTab === 'github' && selectedCommitShas.size === 0)
                  }
                  onClick={handleAnalyzeWithAI}
                  className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm cursor-pointer h-9"
                >
                  {analyzingWithAI ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Analisando com IA...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>
                        Analisar com IA{' '}
                        {activeInputTab === 'github' && selectedCommitShas.size > 0
                          ? `(${selectedCommitShas.size})`
                          : ''}
                      </span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: HUMAN-IN-THE-LOOP APPROVAL VIEW */}
        {step === 'approval' && (
          <div className="space-y-4">
            {/* AI Summary Card */}
            {aiSummary && (
              <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-xs text-indigo-950 dark:text-indigo-200 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5 flex-1">
                  <span className="font-bold text-indigo-900 dark:text-indigo-100">
                    Resumo das Alterações:
                  </span>
                  <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
                    {aiSummary}
                  </p>
                </div>
              </div>
            )}

            {/* Target Session Selection */}
            <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850 space-y-2">
              <label className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-500" />
                <span>Destino das tarefas aprovadas:</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                {activeSession && (
                  <button
                    type="button"
                    onClick={() => setTargetMode('active')}
                    className={`p-2 rounded-md border text-left transition cursor-pointer ${
                      targetMode === 'active'
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-950 dark:text-indigo-200 font-semibold'
                        : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="truncate">Sessão Ativa Atual</span>
                    </div>
                    <p className="text-2xs opacity-80 truncate mt-0.5">
                      {activeSession.title || 'Sem título'}
                    </p>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setTargetMode('new')}
                  className={`p-2 rounded-md border text-left transition cursor-pointer ${
                    targetMode === 'new'
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-950 dark:text-indigo-200 font-semibold'
                      : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Play className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Criar Nova Sessão</span>
                  </div>
                  <p className="text-2xs opacity-80 mt-0.5">Nova entrada no cronômetro</p>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetMode('existing')}
                  className={`p-2 rounded-md border text-left transition cursor-pointer ${
                    targetMode === 'existing'
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-950 dark:text-indigo-200 font-semibold'
                      : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Outra Sessão Existente</span>
                  </div>
                  <p className="text-2xs opacity-80 mt-0.5">Vincular a sessão do histórico</p>
                </button>
              </div>

              {targetMode === 'new' && (
                <div className="pt-2">
                  <Input
                    type="text"
                    placeholder="Título da Nova Sessão"
                    value={newSessionTitle}
                    onChange={(e) => setNewSessionTitle(e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
              )}

              {targetMode === 'existing' && (
                <div className="pt-2">
                  <select
                    value={selectedExistingSessionId}
                    onChange={(e) => setSelectedExistingSessionId(e.target.value)}
                    className="w-full text-xs h-8 px-2.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                  >
                    <option value="">Selecione uma sessão do histórico...</option>
                    {sessions
                      .filter((s) => !s.is_locked)
                      .slice(0, 15)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title || 'Sem título'} (
                          {new Date(s.start_time).toLocaleDateString('pt-BR')})
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>

            {/* Suggested Tasks List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                    Tarefas Sugeridas ({selectedTasksCount} de {suggestedTasks.length} aprovadas)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addNewTask}
                    className="h-7 text-xs gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3 text-indigo-600" />
                    <span>Adicionar Tarefa</span>
                  </Button>
                </div>
              </div>

              {/* Tasks editable rows */}
              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {suggestedTasks.length === 0 ? (
                  <div className="p-8 text-center text-xs text-neutral-400 border border-dashed rounded-lg">
                    Nenhuma tarefa identificada. Clique em "Adicionar Tarefa" para inserir manualmente.
                  </div>
                ) : (
                  suggestedTasks.map((t, idx) => (
                    <div
                      key={t.id}
                      className={`p-3 rounded-lg border transition-all space-y-2 ${
                        t.selected
                          ? 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-2xs'
                          : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-850/50 opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={t.selected}
                          onChange={() => toggleTaskSelected(t.id)}
                          className="mt-1.5 rounded text-indigo-600 cursor-pointer"
                        />

                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-2xs font-bold text-neutral-400 shrink-0">
                              #{idx + 1}
                            </span>
                            <Input
                              type="text"
                              value={t.description}
                              onChange={(e) => updateTaskField(t.id, 'description', e.target.value)}
                              placeholder="Título / Descrição da tarefa entregue"
                              className="text-xs font-medium h-7"
                            />
                            <button
                              type="button"
                              onClick={() => deleteTask(t.id)}
                              className="text-neutral-400 hover:text-rose-500 p-1 cursor-pointer"
                              title="Remover tarefa"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="pl-6 space-y-1.5">
                            <Input
                              type="text"
                              value={t.notes}
                              onChange={(e) => updateTaskField(t.id, 'notes', e.target.value)}
                              placeholder="Notas técnicas (arquivos, componentes, contexto, ticket...)"
                              className="text-2xs h-6 text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-850"
                            />

                            {/* Commit Link Display / Edit */}
                            {t.link ? (
                              <div className="flex items-center gap-1.5 text-2xs text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800/80 px-2 py-1 rounded border border-neutral-200/80 dark:border-neutral-750">
                                <LinkIcon className="w-3 h-3 text-indigo-500 shrink-0" />
                                <span className="text-3xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 shrink-0">
                                  Commit:
                                </span>
                                <a
                                  href={t.link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-indigo-600 dark:text-indigo-400 hover:underline truncate flex-1 font-mono text-3xs"
                                  title={t.link}
                                >
                                  {t.link}
                                </a>
                                <a
                                  href={t.link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-0.5"
                                  title="Abrir URL do commit no repositório"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                                <button
                                  type="button"
                                  onClick={() => updateTaskField(t.id, 'link', '')}
                                  className="text-neutral-400 hover:text-rose-500 p-0.5 cursor-pointer ml-0.5"
                                  title="Remover link"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <Input
                                  type="url"
                                  placeholder="Link do commit (opcional, ex: https://github.com/org/repo/commit/...)"
                                  value={t.link || ''}
                                  onChange={(e) => updateTaskField(t.id, 'link', e.target.value)}
                                  className="text-3xs h-5 text-neutral-500 dark:text-neutral-400 bg-transparent border-dashed"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Bottom Actions for Step 2 */}
            <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('input')}
                disabled={savingTasks}
                className="text-xs cursor-pointer h-11 sm:h-9 w-full sm:w-auto"
              >
                Voltar
              </Button>

              <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  disabled={savingTasks}
                  className="text-xs cursor-pointer h-11 sm:h-9 w-full sm:w-auto"
                >
                  Cancelar
                </Button>

                <Button
                  type="button"
                  disabled={savingTasks || selectedTasksCount === 0}
                  onClick={handleApproveAndSave}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm cursor-pointer h-11 sm:h-9 w-full sm:w-auto"
                >
                  {savingTasks ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      <span>Salvando Tarefas...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 shrink-0" />
                      <span>Aprovar e Criar {selectedTasksCount} Tarefa(s)</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal com Guia Prático de Tokens & Projetos Git */}
      <GitCredentialsGuideModal
        open={guideModalOpen}
        onOpenChange={setGuideModalOpen}
        initialTab={guideModalTab}
      />

      {/* Modal para Gerenciar Permissões e Selecionar Repositórios */}
      <GitRepositoryPermissionModal
        open={permissionModalOpen}
        onOpenChange={setPermissionModalOpen}
        provider={repoProvider}
        token={repoProvider === 'github' ? githubToken : gitlabToken}
        gitlabUrl={repoProvider === 'gitlab' ? gitlabUrl : undefined}
        clientId={currentClient && !showAllWorkspaceRepos ? currentClient.id : undefined}
        clientName={currentClient && !showAllWorkspaceRepos ? currentClient.name : undefined}
        allowedRepositories={currentClient && !showAllWorkspaceRepos ? clientRepositories : allowedRepositories}
        onChangeAllowedRepositories={(repos) => {
          if (currentClient && !showAllWorkspaceRepos) {
            currentClient.allowed_repositories = JSON.stringify(repos);
          } else {
            setAllowedRepositories(repos);
          }
        }}
        defaultRepoFullName={repoProvider === 'github' ? githubRepo : gitlabProject}
        onSelectDefaultRepo={(fullName, defaultBranch) => {
          if (repoProvider === 'github') {
            setGithubRepo(fullName);
            if (defaultBranch) setGithubBranch(defaultBranch);
          } else {
            setGitlabProject(fullName);
            if (defaultBranch) setGitlabBranch(defaultBranch);
          }
        }}
      />
    </Dialog>
  );
}
