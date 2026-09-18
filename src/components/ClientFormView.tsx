import React, { useState } from 'react';
import {
  Briefcase,
  ArrowLeft,
  Save,
  DollarSign,
  Target,
  FolderGit2,
  Github,
  GitBranch,
  ShieldCheck,
  Plus,
  Trash2,
  X,
  ExternalLink,
} from 'lucide-react';
import { Client, Tenant, GitRepositoryItem } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useToast } from './ui/toast';
import { apiFetch } from '../utils/api';
import { GitRepositoryPermissionModal } from './GitRepositoryPermissionModal';

interface ClientFormViewProps {
  client?: Client | null;
  tenant?: Tenant | null;
  onRefreshClients: () => Promise<void>;
  onBack: () => void;
  defaultHourlyRate: number;
}

export function ClientFormView({
  client,
  tenant,
  onRefreshClients,
  onBack,
  defaultHourlyRate,
}: ClientFormViewProps) {
  const { addToast } = useToast();
  const isEditing = Boolean(client);

  const [name, setName] = useState(client ? client.name : '');
  const [company, setCompany] = useState(client ? client.company || '' : '');
  const [email, setEmail] = useState(client ? client.email || '' : '');
  const [hourlyRate, setHourlyRate] = useState(client && client.hourly_rate ? client.hourly_rate.toString() : '');
  const [dailyTargetMinutes, setDailyTargetMinutes] = useState(
    client && client.daily_target_minutes ? client.daily_target_minutes.toString() : ''
  );
  const [notes, setNotes] = useState(client ? client.notes || '' : '');
  const [submitting, setSubmitting] = useState(false);

  // Git integration state per client
  const [gitProvider, setGitProvider] = useState<'none' | 'github' | 'gitlab'>(
    client ? (client.git_provider || (client.gitlab_project ? 'gitlab' : client.github_repo ? 'github' : 'none')) : 'none'
  );
  const [githubRepo, setGithubRepo] = useState(client ? client.github_repo || '' : '');
  const [githubToken, setGithubToken] = useState(client ? client.github_token || '' : '');
  const [gitlabUrl, setGitlabUrl] = useState(client ? client.gitlab_url || 'https://gitlab.com' : 'https://gitlab.com');
  const [gitlabProject, setGitlabProject] = useState(client ? client.gitlab_project || '' : '');
  const [gitlabToken, setGitlabToken] = useState(client ? client.gitlab_token || '' : '');
  const [clientAllowedRepositories, setClientAllowedRepositories] = useState<GitRepositoryItem[]>(() => {
    if (client && client.allowed_repositories) {
      try {
        const parsed = JSON.parse(client.allowed_repositories);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  });
  const [newRepoInput, setNewRepoInput] = useState('');
  const [clientRepoModalOpen, setClientRepoModalOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast({ title: 'Nome obrigatório', description: 'Informe o nome do cliente.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        company: company.trim() || null,
        email: email.trim() || null,
        hourly_rate: hourlyRate ? parseFloat(hourlyRate) : null,
        daily_target_minutes: dailyTargetMinutes ? parseInt(dailyTargetMinutes, 10) : null,
        notes: notes.trim() || null,
        git_provider: gitProvider === 'none' ? null : gitProvider,
        github_repo: gitProvider === 'github' ? (githubRepo.trim() || null) : null,
        github_token: gitProvider === 'github' ? (githubToken.trim() || null) : null,
        gitlab_url: gitProvider === 'gitlab' ? (gitlabUrl.trim() || null) : null,
        gitlab_project: gitProvider === 'gitlab' ? (gitlabProject.trim() || null) : null,
        gitlab_token: gitProvider === 'gitlab' ? (gitlabToken.trim() || null) : null,
        allowed_repositories: clientAllowedRepositories.length > 0 ? JSON.stringify(clientAllowedRepositories) : null,
      };

      if (isEditing && client) {
        const res = await apiFetch(`/api/clients/${client.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao atualizar cliente');
        addToast({ title: 'Cliente atualizado com sucesso!', variant: 'default' });
      } else {
        const res = await apiFetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao cadastrar cliente');
        addToast({ title: 'Cliente cadastrado com sucesso!', variant: 'default' });
      }

      await onRefreshClients();
      onBack();
    } catch (err: any) {
      addToast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-3xl mx-auto px-3 sm:px-6 py-4 pb-24 animate-in fade-in duration-200">
      {/* Header with Back button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200 dark:border-neutral-800 pb-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="gap-1.5 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 cursor-pointer h-10 sm:h-9 px-3 text-xs sm:text-sm"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span>Voltar para Clientes</span>
          </Button>
        </div>
        <h2 className="text-lg sm:text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span>{isEditing ? `Editar Cliente: ${client?.name}` : 'Cadastrar Novo Cliente'}</span>
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
        {/* Basic Info Card */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 border-b border-neutral-100 dark:border-neutral-800 pb-3">
            Informações Principais
          </h3>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              Nome do Cliente / Projeto *
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: João Silva ou Projeto Alpha"
              required
              className="text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Empresa / Organização
              </label>
              <Input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Ex: Acme Corporation"
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                E-mail de Contato
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contato@empresa.com"
                className="text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Taxa por Hora Específica (R$)
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder={`Padrão: R$ ${defaultHourlyRate}`}
                className="text-sm font-mono"
              />
              <p className="text-2xs text-neutral-400">
                Deixe em branco para usar a taxa padrão do workspace.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Meta Diária de Tempo (minutos)</span>
              </label>
              <Input
                type="number"
                min="0"
                step="1"
                value={dailyTargetMinutes}
                onChange={(e) => setDailyTargetMinutes(e.target.value)}
                placeholder="Ex: 480 (8h por dia)"
                className="text-sm font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              Observações / Notas Internas
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Detalhes sobre escopo, contratos ou horários..."
              className="w-full rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-850 px-3 py-2 text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Git Integration & Repositories Card */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <FolderGit2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Integração de Repositórios Git (Opcional)</span>
            </h3>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              Provedor Git
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setGitProvider('none')}
                className={`px-4 py-2.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-2 ${
                  gitProvider === 'none'
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                    : 'border-neutral-200 dark:border-neutral-750 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                }`}
              >
                <span>Nenhum</span>
              </button>
              <button
                type="button"
                onClick={() => setGitProvider('github')}
                className={`px-4 py-2.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-2 ${
                  gitProvider === 'github'
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                    : 'border-neutral-200 dark:border-neutral-750 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                }`}
              >
                <Github className="w-3.5 h-3.5" />
                <span>GitHub</span>
              </button>
              <button
                type="button"
                onClick={() => setGitProvider('gitlab')}
                className={`px-4 py-2.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-2 ${
                  gitProvider === 'gitlab'
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                    : 'border-neutral-200 dark:border-neutral-750 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                }`}
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>GitLab</span>
              </button>
            </div>
          </div>

          {gitProvider === 'github' && (
            <div className="space-y-4 pt-2 border-t border-neutral-100 dark:border-neutral-800 animate-in fade-in duration-150">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Repositório Principal GitHub (dono/projeto)
                </label>
                <Input
                  value={githubRepo}
                  onChange={(e) => setGithubRepo(e.target.value)}
                  placeholder="ex: facebook/react ou usuario/meu-projeto"
                  className="text-sm font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Token de Acesso Pessoal (GitHub Personal Access Token)
                </label>
                <Input
                  type="password"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxx"
                  className="text-sm font-mono"
                />
              </div>
            </div>
          )}

          {gitProvider === 'gitlab' && (
            <div className="space-y-4 pt-2 border-t border-neutral-100 dark:border-neutral-800 animate-in fade-in duration-150">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  URL da Instância GitLab
                </label>
                <Input
                  value={gitlabUrl}
                  onChange={(e) => setGitlabUrl(e.target.value)}
                  placeholder="https://gitlab.com ou URL corporativa"
                  className="text-sm font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Projeto Principal GitLab (grupo/projeto)
                </label>
                <Input
                  value={gitlabProject}
                  onChange={(e) => setGitlabProject(e.target.value)}
                  placeholder="ex: meu-grupo/meu-servico"
                  className="text-sm font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Token de Acesso GitLab (Personal Access Token / Project Token)
                </label>
                <Input
                  type="password"
                  value={gitlabToken}
                  onChange={(e) => setGitlabToken(e.target.value)}
                  placeholder="glpat-xxxxxxxxxxxx"
                  className="text-sm font-mono"
                />
              </div>
            </div>
          )}

          {gitProvider !== 'none' && (
            <div className="space-y-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                    Repositórios Adicionais Permitidos ({clientAllowedRepositories.length})
                  </h4>
                  <p className="text-2xs text-neutral-500">
                    Na sessão de foco deste cliente, apenas os repositórios listados serão exibidos.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setClientRepoModalOpen(true)}
                  className="h-8 text-xs gap-1.5 cursor-pointer"
                >
                  <FolderGit2 className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Selecionar da Conta</span>
                </Button>
              </div>

              {clientAllowedRepositories.length > 0 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {clientAllowedRepositories.map((repo, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-750 text-xs font-mono"
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <FolderGit2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span className="truncate text-neutral-800 dark:text-neutral-200">{repo.fullName}</span>
                        {repo.isPrivate && (
                          <span className="text-3xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                            Privado
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setClientAllowedRepositories(clientAllowedRepositories.filter((_, i) => i !== idx))
                        }
                        className="text-neutral-400 hover:text-red-600 transition-colors cursor-pointer"
                        title="Remover repositório"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Form Footer Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="cursor-pointer text-xs h-11 sm:h-10 w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer text-xs h-11 sm:h-10 w-full sm:w-auto shadow-sm"
          >
            <Save className="w-4 h-4 shrink-0" />
            <span>{submitting ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Cadastrar Cliente'}</span>
          </Button>
        </div>
      </form>

      {/* Git Repository Permission Selector Modal */}
      {clientRepoModalOpen && (
        <GitRepositoryPermissionModal
          open={clientRepoModalOpen}
          onOpenChange={setClientRepoModalOpen}
          provider={gitProvider === 'gitlab' ? 'gitlab' : 'github'}
          token={gitProvider === 'gitlab' ? gitlabToken : githubToken}
          gitlabUrl={gitProvider === 'gitlab' ? gitlabUrl : undefined}
          clientId={client?.id}
          clientName={name || 'Cliente'}
          allowedRepositories={clientAllowedRepositories}
          onChangeAllowedRepositories={(repos) => setClientAllowedRepositories(repos)}
        />
      )}
    </div>
  );
}
