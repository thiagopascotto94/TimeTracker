import React, { useState, useEffect, useMemo } from 'react';
import {
  FolderGit2,
  CheckSquare,
  Square,
  Search,
  CheckCircle2,
  Lock,
  Globe,
  GitBranch,
  RefreshCw,
  ExternalLink,
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Star,
  Layers,
  Github,
  Server,
  GitPullRequest,
  Check,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { GitRepositoryItem } from '../types';
import { apiFetch } from '../utils/api';
import { useToast } from './ui/toast';

interface GitRepositoryPermissionManagerProps {
  provider: 'github' | 'gitlab';
  token?: string;
  gitlabUrl?: string;
  clientId?: string;
  allowedRepositories: GitRepositoryItem[];
  onChangeAllowedRepositories: (repos: GitRepositoryItem[]) => void;
  onSelectDefaultRepo?: (repoFullName: string, defaultBranch?: string) => void;
  defaultRepoFullName?: string;
  className?: string;
}

export function GitRepositoryPermissionManager({
  provider,
  token,
  gitlabUrl,
  clientId,
  allowedRepositories,
  onChangeAllowedRepositories,
  onSelectDefaultRepo,
  defaultRepoFullName,
  className = '',
}: GitRepositoryPermissionManagerProps) {
  const { addToast } = useToast();

  const [discoveredRepos, setDiscoveredRepos] = useState<GitRepositoryItem[]>([]);
  const [loadingDiscovery, setLoadingDiscovery] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [hasDiscovered, setHasDiscovered] = useState(false);

  // Search and filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVisibility, setFilterVisibility] = useState<'all' | 'private' | 'public'>('all');

  // Manual Add Form state
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualFullName, setManualFullName] = useState('');
  const [manualBranch, setManualBranch] = useState('main');
  const [manualIsPrivate, setManualIsPrivate] = useState(true);

  // Fetch repositories from token API
  const handleDiscoverRepositories = async () => {
    setLoadingDiscovery(true);
    setDiscoveryError(null);

    try {
      const payload: Record<string, any> = {
        provider,
      };
      if (token && token.trim()) {
        payload.token = token.trim();
      }
      if (clientId) {
        payload.client_id = clientId;
      }
      if (provider === 'gitlab' && gitlabUrl) {
        payload.gitlabUrl = gitlabUrl;
      }

      const res = await apiFetch('/api/git/list-repositories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Falha ao listar repositórios da conta');
      }

      if (resData && Array.isArray(resData.repositories)) {
        setDiscoveredRepos(resData.repositories);
        setHasDiscovered(true);
        addToast({
          title: 'Repositórios listados',
          description: `${resData.repositories.length} repositório(s) encontrados na sua conta ${provider === 'gitlab' ? 'GitLab' : 'GitHub'}.`,
          variant: 'success',
        });
      } else {
        setDiscoveredRepos([]);
      }
    } catch (err: any) {
      console.error('Error discovering repositories:', err);
      const msg = err.message || 'Não foi possível listar os repositórios. Verifique o token e as permissões.';
      setDiscoveryError(msg);
      addToast({
        title: 'Falha ao listar repositórios',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setLoadingDiscovery(false);
    }
  };

  const hasTokenConfigured = Boolean(token && token.trim());

  // Check if a repo is currently permitted
  const isRepoAllowed = (repoFullName: string, repoProvider: 'github' | 'gitlab') => {
    return allowedRepositories.some(
      (r) => r.provider === repoProvider && r.fullName.toLowerCase() === repoFullName.toLowerCase()
    );
  };

  // Toggle single repo permission
  const handleToggleRepo = (repo: GitRepositoryItem) => {
    const exists = isRepoAllowed(repo.fullName, repo.provider);
    if (exists) {
      const updated = allowedRepositories.filter(
        (r) => !(r.provider === repo.provider && r.fullName.toLowerCase() === repo.fullName.toLowerCase())
      );
      onChangeAllowedRepositories(updated);
    } else {
      const updated = [...allowedRepositories, { ...repo, selected: true }];
      onChangeAllowedRepositories(updated);
    }
  };

  // Select all filtered discovered repos
  const handleSelectAllFiltered = () => {
    const newItems: GitRepositoryItem[] = [...allowedRepositories];
    filteredDiscoveredRepos.forEach((repo) => {
      if (!isRepoAllowed(repo.fullName, repo.provider)) {
        newItems.push({ ...repo, selected: true });
      }
    });
    onChangeAllowedRepositories(newItems);
    addToast({
      title: 'Permissões atualizadas',
      description: `${filteredDiscoveredRepos.length} repositório(s) adicionados à permissão.`,
      variant: 'success',
    });
  };

  // Deselect all filtered discovered repos
  const handleDeselectAllFiltered = () => {
    const filterNames = new Set(filteredDiscoveredRepos.map((r) => r.fullName.toLowerCase()));
    const updated = allowedRepositories.filter(
      (r) => !(r.provider === provider && filterNames.has(r.fullName.toLowerCase()))
    );
    onChangeAllowedRepositories(updated);
  };

  // Remove permitted repo
  const handleRemoveAllowed = (repoToRemove: GitRepositoryItem) => {
    const updated = allowedRepositories.filter(
      (r) => !(r.provider === repoToRemove.provider && r.fullName.toLowerCase() === repoToRemove.fullName.toLowerCase())
    );
    onChangeAllowedRepositories(updated);
  };

  // Add manual repository
  const handleAddManualRepo = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = manualFullName.trim().replace(/^https?:\/\/[^/]+\//i, '').replace(/\.git$/i, '');
    if (!cleanName) {
      addToast({
        title: 'Nome inválido',
        description: 'Informe o identificador do repositório (ex: grupo/projeto).',
        variant: 'destructive',
      });
      return;
    }

    if (isRepoAllowed(cleanName, provider)) {
      addToast({
        title: 'Repositório já autorizado',
        description: 'Este repositório já está na lista de permissões.',
        variant: 'default',
      });
      return;
    }

    const newItem: GitRepositoryItem = {
      id: `${provider}:${cleanName}`,
      provider,
      fullName: cleanName,
      name: cleanName.split('/').pop() || cleanName,
      owner: cleanName.includes('/') ? cleanName.split('/')[0] : undefined,
      defaultBranch: manualBranch.trim() || 'main',
      isPrivate: manualIsPrivate,
      gitlabUrl: provider === 'gitlab' ? gitlabUrl : undefined,
      selected: true,
    };

    onChangeAllowedRepositories([...allowedRepositories, newItem]);
    setManualFullName('');
    setShowManualAdd(false);
    addToast({
      title: 'Repositório autorizado',
      description: `"${cleanName}" adicionado à lista de permissões do workspace.`,
      variant: 'success',
    });
  };

  // Filter discovered repos based on search query & visibility
  const filteredDiscoveredRepos = useMemo(() => {
    return discoveredRepos.filter((r) => {
      // visibility filter
      if (filterVisibility === 'private' && !r.isPrivate) return false;
      if (filterVisibility === 'public' && r.isPrivate) return false;

      // search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = r.fullName.toLowerCase().includes(q);
        const matchesOwner = r.owner ? r.owner.toLowerCase().includes(q) : false;
        const matchesDesc = r.description ? r.description.toLowerCase().includes(q) : false;
        return matchesName || matchesOwner || matchesDesc;
      }
      return true;
    });
  }, [discoveredRepos, searchQuery, filterVisibility]);

  // Current provider allowed repos
  const providerAllowedRepos = useMemo(() => {
    return allowedRepositories.filter((r) => r.provider === provider);
  }, [allowedRepositories, provider]);

  return (
    <div className={`space-y-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/60 p-4 ${className}`}>
      {/* Header & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200 dark:border-neutral-800 pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
              Permissão de Repositórios ({provider === 'gitlab' ? 'GitLab' : 'GitHub'})
            </h4>
            <Badge variant="outline" className="text-2xs font-semibold">
              {providerAllowedRepos.length} autorizado(s)
            </Badge>
          </div>
          <p className="text-2xs text-neutral-500 dark:text-neutral-400">
            Selecione quais repositórios terão acesso permitido para registro de tempo e análise de commits via IA.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowManualAdd(!showManualAdd)}
            className="h-7 text-xs gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar Manual</span>
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={loadingDiscovery}
            onClick={handleDiscoverRepositories}
            className="h-7 text-xs gap-1.5 cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {loadingDiscovery ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Listando Repositórios...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Listar da Minha Conta</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Manual Add Drawer/Form */}
      {showManualAdd && (
        <form
          onSubmit={handleAddManualRepo}
          className="p-3 rounded-lg border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
              <FolderGit2 className="w-3.5 h-3.5" />
              <span>Adicionar Repositório Manualmente</span>
            </span>
            <button
              type="button"
              onClick={() => setShowManualAdd(false)}
              className="text-neutral-400 hover:text-neutral-600 text-xs"
            >
              Fechar
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-2xs font-semibold text-neutral-700 dark:text-neutral-300">
                Caminho / Identificador do Repositório:
              </label>
              <Input
                type="text"
                placeholder={provider === 'gitlab' ? 'ex: empresa/backend ou ID numérico' : 'ex: organizacao/projeto'}
                value={manualFullName}
                onChange={(e) => setManualFullName(e.target.value)}
                className="h-8 text-xs font-mono"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-2xs font-semibold text-neutral-700 dark:text-neutral-300">
                Branch Padrão:
              </label>
              <Input
                type="text"
                placeholder="main"
                value={manualBranch}
                onChange={(e) => setManualBranch(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-1.5 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
              <input
                type="checkbox"
                checked={manualIsPrivate}
                onChange={(e) => setManualIsPrivate(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span>Repositório Privado (exige PAT)</span>
            </label>

            <Button type="submit" size="sm" className="h-7 text-xs gap-1.5 bg-indigo-600 text-white">
              <Check className="w-3.5 h-3.5" />
              <span>Autorizar Repositório</span>
            </Button>
          </div>
        </form>
      )}

      {/* Discovery Error message */}
      {discoveryError && (
        <div className="p-3 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold">Erro ao comunicar com a API do {provider === 'gitlab' ? 'GitLab' : 'GitHub'}</p>
            <p className="text-2xs opacity-90">{discoveryError}</p>
          </div>
        </div>
      )}

      {/* DISCOVERED REPOSITORIES CHECKLIST MODAL/ACCORDION */}
      {hasDiscovered && (
        <div className="space-y-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-850 p-3 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 dark:border-neutral-800 pb-2">
            <div className="flex items-center gap-2">
              <FolderGit2 className="w-4 h-4 text-indigo-500" />
              <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                Repositórios Encontrados na sua Conta ({filteredDiscoveredRepos.length} de {discoveredRepos.length})
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSelectAllFiltered}
                className="h-6 px-2 text-2xs gap-1 text-neutral-600 dark:text-neutral-300 hover:text-indigo-600"
              >
                <CheckSquare className="w-3 h-3" />
                <span>Selecionar Todos</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDeselectAllFiltered}
                className="h-6 px-2 text-2xs gap-1 text-neutral-600 dark:text-neutral-300 hover:text-rose-600"
              >
                <Square className="w-3 h-3" />
                <span>Desmarcar Todos</span>
              </Button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
            <div className="relative flex-1 w-full">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
              <Input
                type="text"
                placeholder="Filtrar por nome, grupo ou descrição..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>

            <div className="inline-flex rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 p-0.5 text-2xs shrink-0">
              <button
                type="button"
                onClick={() => setFilterVisibility('all')}
                className={`px-2.5 py-1 rounded transition ${
                  filterVisibility === 'all'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 font-semibold shadow-2xs'
                    : 'text-neutral-600 dark:text-neutral-400'
                }`}
              >
                Todos ({discoveredRepos.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterVisibility('private')}
                className={`px-2.5 py-1 rounded transition ${
                  filterVisibility === 'private'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 font-semibold shadow-2xs'
                    : 'text-neutral-600 dark:text-neutral-400'
                }`}
              >
                Privados ({discoveredRepos.filter((r) => r.isPrivate).length})
              </button>
              <button
                type="button"
                onClick={() => setFilterVisibility('public')}
                className={`px-2.5 py-1 rounded transition ${
                  filterVisibility === 'public'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 font-semibold shadow-2xs'
                    : 'text-neutral-600 dark:text-neutral-400'
                }`}
              >
                Públicos ({discoveredRepos.filter((r) => !r.isPrivate).length})
              </button>
            </div>
          </div>

          {/* Repositories Scroll List */}
          <div className="max-h-60 overflow-y-auto space-y-1.5 divide-y divide-neutral-100 dark:divide-neutral-800/60 pr-1">
            {filteredDiscoveredRepos.length === 0 ? (
              <div className="text-center py-6 text-xs text-neutral-400">
                Nenhum repositório corresponde aos filtros selecionados.
              </div>
            ) : (
              filteredDiscoveredRepos.map((repo) => {
                const allowed = isRepoAllowed(repo.fullName, repo.provider);
                const isDefault = defaultRepoFullName && defaultRepoFullName.toLowerCase() === repo.fullName.toLowerCase();

                return (
                  <div
                    key={repo.id}
                    onClick={() => handleToggleRepo(repo)}
                    className={`pt-1.5 first:pt-0 flex items-start gap-2.5 p-2 rounded-md transition-colors cursor-pointer ${
                      allowed
                        ? 'bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/40'
                        : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
                    }`}
                  >
                    <div className="pt-0.5 shrink-0">
                      <input
                        type="checkbox"
                        checked={allowed}
                        onChange={() => {}} // Handled by container onClick
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      />
                    </div>

                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 font-mono truncate">
                          {repo.fullName}
                        </span>

                        {repo.isPrivate ? (
                          <Badge variant="outline" className="text-3xs py-0 h-4 px-1 gap-0.5 text-neutral-500">
                            <Lock className="w-2.5 h-2.5" />
                            Privado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-3xs py-0 h-4 px-1 gap-0.5 text-emerald-600 dark:text-emerald-400 border-emerald-300">
                            <Globe className="w-2.5 h-2.5" />
                            Público
                          </Badge>
                        )}

                        {repo.defaultBranch && (
                          <span className="text-3xs font-mono text-neutral-400 flex items-center gap-0.5">
                            <GitBranch className="w-2.5 h-2.5" />
                            {repo.defaultBranch}
                          </span>
                        )}

                        {isDefault && (
                          <Badge variant="success" className="text-3xs py-0 h-4 px-1 gap-0.5">
                            <Star className="w-2.5 h-2.5 fill-current" />
                            Padrão
                          </Badge>
                        )}
                      </div>

                      {repo.description && (
                        <p className="text-2xs text-neutral-500 dark:text-neutral-400 line-clamp-1">
                          {repo.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {onSelectDefaultRepo && allowed && !isDefault && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onSelectDefaultRepo(repo.fullName, repo.defaultBranch)}
                          className="h-6 px-1.5 text-3xs text-neutral-500 hover:text-indigo-600 gap-1"
                          title="Definir como repositório principal do workspace"
                        >
                          <Star className="w-3 h-3" />
                          <span>Padrão</span>
                        </Button>
                      )}

                      {repo.url && (
                        <a
                          href={repo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                          title="Abrir repositório"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* SUMMARY LIST OF AUTHORIZED REPOSITORIES */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-500" />
            <span>Repositórios Autorizados no Workspace:</span>
          </span>
          <span className="text-2xs text-neutral-500">
            {providerAllowedRepos.length} selecionado(s)
          </span>
        </div>

        {providerAllowedRepos.length === 0 ? (
          <div className="p-4 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-750 bg-white/50 dark:bg-neutral-900/30 text-center space-y-1.5">
            <FolderGit2 className="w-6 h-6 text-neutral-400 mx-auto" />
            <p className="text-xs text-neutral-600 dark:text-neutral-400 font-medium">
              Nenhum repositório {provider === 'gitlab' ? 'GitLab' : 'GitHub'} adicionado na permissão ainda.
            </p>
            <p className="text-2xs text-neutral-500 max-w-sm mx-auto">
              Clique em <strong>"Listar da Minha Conta"</strong> para ver todos os seus projetos ou use <strong>"Adicionar Manual"</strong>.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {providerAllowedRepos.map((repo) => {
              const isDefault = defaultRepoFullName && defaultRepoFullName.toLowerCase() === repo.fullName.toLowerCase();

              return (
                <div
                  key={repo.id || repo.fullName}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-850 shadow-2xs group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-md bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                      {repo.provider === 'gitlab' ? (
                        <GitPullRequest className="w-3.5 h-3.5 text-orange-500" />
                      ) : (
                        <Github className="w-3.5 h-3.5 text-neutral-700 dark:text-neutral-200" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 font-mono truncate">
                          {repo.fullName}
                        </span>
                        {isDefault && (
                          <Badge variant="success" className="text-3xs py-0 h-4 px-1 gap-0.5">
                            Padrão
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-2xs text-neutral-500 font-mono">
                        <span>branch: {repo.defaultBranch || 'main'}</span>
                        {repo.isPrivate && <span className="text-amber-500">• privado</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {onSelectDefaultRepo && !isDefault && (
                      <button
                        type="button"
                        onClick={() => onSelectDefaultRepo(repo.fullName, repo.defaultBranch)}
                        className="p-1 text-neutral-400 hover:text-amber-500 transition cursor-pointer"
                        title="Definir como repositório padrão"
                      >
                        <Star className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {repo.url && (
                      <a
                        href={repo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition"
                        title="Abrir no navegador"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveAllowed(repo)}
                      className="p-1 text-neutral-400 hover:text-rose-500 transition cursor-pointer"
                      title="Remover permissão deste repositório"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
