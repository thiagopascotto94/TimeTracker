import { Router, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../auth';
import { Client } from '../db';

export const gitRouter = Router();

gitRouter.use(authMiddleware);

// Helper to sanitize GitHub repository string (handles "https://github.com/owner/repo" or "owner/repo")
function cleanGitHubRepo(raw: string): string {
  let repo = String(raw || '').trim();
  repo = repo.replace(/^https?:\/\/github\.com\//i, '');
  repo = repo.replace(/\.git$/i, '');
  repo = repo.replace(/^\/+|\/+$/g, '');
  return repo;
}

// Helper to parse and sanitize GitLab Project and Host (supports SaaS and Self-Hosted / On-Premises)
function parseGitLabTarget(rawProject: string, defaultHost?: string | null): { host: string; project: string } {
  let cleaned = String(rawProject || '').trim();
  let host = String(defaultHost || 'https://gitlab.com').trim().replace(/\/+$/, '');

  if (/^https?:\/\//i.test(cleaned)) {
    try {
      const parsed = new URL(cleaned);
      host = parsed.origin;
      cleaned = parsed.pathname.replace(/^\/+|\/+$/g, '');
      cleaned = cleaned.replace(/\.git$/i, '');
      // Strip /-/tree/main or /-/blob/... if user pasted URL directly from the browser bar
      cleaned = cleaned.replace(/\/-.*$/, '');
    } catch {
      // ignore
    }
  } else {
    cleaned = cleaned.replace(/^\/+|\/+$/g, '').replace(/\.git$/i, '');
  }

  return { host, project: cleaned };
}

// POST /api/git/commits
// Lists recent commits from GitHub or GitLab (SaaS or Self-Hosted)
gitRouter.post('/commits', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      provider: requestedProvider,
      repo,
      project: requestedProject,
      gitlabUrl: requestedGitlabUrl,
      branch,
      token,
      per_page = 15,
      client_id: requestedClientId,
      clientId: requestedClientIdAlt,
    } = req.body || {};

    const tenant = req.tenant;

    const clientId = requestedClientId || requestedClientIdAlt;
    let targetClient: Client | null = null;
    if (clientId) {
      targetClient = await Client.findOne({
        where: { id: clientId, tenant_id: req.tenantId! },
      });
    }

    // Resolve provider: body explicit -> client saved -> tenant saved -> default 'github'
    const provider: 'github' | 'gitlab' =
      requestedProvider === 'gitlab' ||
      (!requestedProvider && targetClient?.git_provider === 'gitlab') ||
      (!requestedProvider && !targetClient?.git_provider && tenant?.git_provider === 'gitlab')
        ? 'gitlab'
        : 'github';

    // ==========================================
    // GITLAB (SaaS & Self-Hosted / On-Premise)
    // ==========================================
    if (provider === 'gitlab') {
      const rawProject =
        requestedProject || repo || targetClient?.gitlab_project || tenant?.gitlab_project;
      if (!rawProject || !String(rawProject).trim()) {
        return res.status(400).json({
          error: 'Informe o projeto do GitLab (ex: "grupo/projeto", ID numérico ou a URL completa do projeto).',
        });
      }

      const defaultHost =
        requestedGitlabUrl || targetClient?.gitlab_url || tenant?.gitlab_url || 'https://gitlab.com';
      const { host, project } = parseGitLabTarget(rawProject, defaultHost);

      if (!project) {
        return res.status(400).json({
          error: 'Projeto do GitLab inválido. Utilize "grupo/projeto", o ID numérico ou a URL do projeto.',
        });
      }

      // Resolve GitLab Token: body token -> client token -> tenant stored token -> env GITLAB_TOKEN
      const resolvedToken =
        (token && String(token).trim()) ||
        targetClient?.gitlab_token ||
        tenant?.gitlab_token ||
        process.env.GITLAB_TOKEN ||
        null;

      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'User-Agent': 'Cronos-Time-Tracker-App',
      };

      if (resolvedToken) {
        headers['PRIVATE-TOKEN'] = resolvedToken;
      }

      const encodedProject = encodeURIComponent(project);
      const queryParams = new URLSearchParams();
      queryParams.set('per_page', String(per_page));
      if (branch && String(branch).trim()) {
        queryParams.set('ref_name', String(branch).trim());
      }

      const targetUrl = `${host}/api/v4/projects/${encodedProject}/repository/commits?${queryParams.toString()}`;

      const glResponse = await fetch(targetUrl, {
        method: 'GET',
        headers,
      });

      if (!glResponse.ok) {
        const status = glResponse.status;
        let errorBody: any = null;
        try {
          errorBody = await glResponse.json();
        } catch {
          // ignore
        }

        if (status === 404) {
          return res.status(404).json({
            error: `Projeto "${project}" não foi encontrado no GitLab (${host}). Se for um repositório privado ou interno, forneça um Personal Access Token com escopo "read_api" ou "read_repository".`,
          });
        } else if (status === 401) {
          return res.status(401).json({
            error: 'Token do GitLab inválido ou expirado. Verifique seu Personal Access Token nas configurações.',
          });
        } else if (status === 403) {
          return res.status(403).json({
            error: errorBody?.message || 'Acesso negado no GitLab. O token não tem permissão para ler este repositório.',
          });
        }

        return res.status(status).json({
          error: errorBody?.message || errorBody?.error || `Erro ao consultar a API do GitLab (${host}): HTTP ${status}.`,
        });
      }

      const commitsData = await glResponse.json();
      if (!Array.isArray(commitsData)) {
        return res.json({
          provider: 'gitlab',
          host,
          project,
          repo: project,
          branch: branch || 'padrão',
          commits: [],
        });
      }

      const commits = commitsData.map((c: any) => ({
        sha: c.id,
        shortSha: c.short_id || (c.id ? c.id.slice(0, 7) : ''),
        message: c.message || c.title || '',
        author: c.author_name || c.committer_name || 'Autor desconhecido',
        authorAvatar: null,
        date: c.authored_date || c.committed_date || c.created_at || '',
        url: c.web_url || `${host}/${project}/-/commit/${c.id}`,
        provider: 'gitlab',
      }));

      return res.json({
        provider: 'gitlab',
        host,
        project,
        repo: project,
        branch: branch || 'padrão',
        commits,
      });
    }

    // ==========================================
    // GITHUB (api.github.com)
    // ==========================================
    const rawRepo = repo || requestedProject || targetClient?.github_repo || tenant?.github_repo;
    if (!rawRepo || !String(rawRepo).trim()) {
      return res.status(400).json({
        error: 'Informe o repositório do GitHub no formato dono/repositorio (ex: facebook/react ou a URL completa).',
      });
    }

    const cleanRepo = cleanGitHubRepo(rawRepo);
    const parts = cleanRepo.split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return res.status(400).json({
        error: 'Formato de repositório inválido. Utilize "dono/repositorio" ou a URL do GitHub.',
      });
    }

    // Resolve GitHub Token: body token -> client token -> tenant stored token -> env GITHUB_TOKEN
    const resolvedToken =
      (token && String(token).trim()) ||
      targetClient?.github_token ||
      tenant?.github_token ||
      process.env.GITHUB_TOKEN ||
      null;

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Cronos-Time-Tracker-App',
    };

    if (resolvedToken) {
      headers['Authorization'] = `Bearer ${resolvedToken}`;
    }

    const branchParam =
      branch && String(branch).trim()
        ? `?sha=${encodeURIComponent(String(branch).trim())}&per_page=${per_page}`
        : `?per_page=${per_page}`;
    const targetUrl = `https://api.github.com/repos/${cleanRepo}/commits${branchParam}`;

    const ghResponse = await fetch(targetUrl, {
      method: 'GET',
      headers,
    });

    if (!ghResponse.ok) {
      const status = ghResponse.status;
      let errorBody: any = null;
      try {
        errorBody = await ghResponse.json();
      } catch {
        // ignore
      }

      if (status === 404) {
        return res.status(404).json({
          error: `Repositório "${cleanRepo}" não foi encontrado no GitHub. Se for um repositório privado, informe um Personal Access Token (PAT) válido.`,
        });
      } else if (status === 401) {
        return res.status(401).json({
          error: 'Token do GitHub inválido, revogado ou sem permissões necessárias.',
        });
      } else if (status === 403) {
        return res.status(403).json({
          error:
            errorBody?.message ||
            'Limite de taxa da API do GitHub excedido para requisições anônimas. Forneça um Personal Access Token (PAT) para continuar.',
        });
      }

      return res.status(status).json({
        error: errorBody?.message || `Erro da API do GitHub (HTTP ${status}).`,
      });
    }

    const commitsData = await ghResponse.json();
    if (!Array.isArray(commitsData)) {
      return res.json({
        provider: 'github',
        repo: cleanRepo,
        project: cleanRepo,
        branch: branch || 'padrão',
        commits: [],
      });
    }

    const commits = commitsData.map((c: any) => ({
      sha: c.sha,
      shortSha: c.sha ? c.sha.slice(0, 7) : '',
      message: c.commit?.message || '',
      author: c.commit?.author?.name || c.author?.login || 'Autor desconhecido',
      authorAvatar: c.author?.avatar_url || null,
      date: c.commit?.author?.date || c.commit?.committer?.date || '',
      url: c.html_url || `https://github.com/${cleanRepo}/commit/${c.sha}`,
      provider: 'github',
    }));

    return res.json({
      provider: 'github',
      repo: cleanRepo,
      project: cleanRepo,
      branch: branch || 'padrão',
      commits,
    });
  } catch (err: any) {
    console.error('Git commits fetch error:', err);
    res.status(500).json({ error: err.message || 'Falha ao conectar com o serviço de Git' });
  }
});

// POST /api/git/commit-detail
// Fetches detailed files and diff stats for a specific commit (GitHub or GitLab)
gitRouter.post('/commit-detail', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      provider: requestedProvider,
      repo,
      project: requestedProject,
      gitlabUrl: requestedGitlabUrl,
      sha,
      token,
    } = req.body || {};

    if (!sha) {
      return res.status(400).json({ error: 'SHA do commit é obrigatório' });
    }

    const tenant = req.tenant;
    const provider: 'github' | 'gitlab' =
      requestedProvider === 'gitlab' || (!requestedProvider && tenant?.git_provider === 'gitlab')
        ? 'gitlab'
        : 'github';

    // GitLab commit detail & diff
    if (provider === 'gitlab') {
      const rawProject = requestedProject || repo || tenant?.gitlab_project;
      if (!rawProject) {
        return res.status(400).json({ error: 'Projeto do GitLab é obrigatório' });
      }

      const defaultHost = requestedGitlabUrl || tenant?.gitlab_url || 'https://gitlab.com';
      const { host, project } = parseGitLabTarget(rawProject, defaultHost);
      const resolvedToken =
        (token && String(token).trim()) || tenant?.gitlab_token || process.env.GITLAB_TOKEN || null;

      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'User-Agent': 'Cronos-Time-Tracker-App',
      };
      if (resolvedToken) {
        headers['PRIVATE-TOKEN'] = resolvedToken;
      }

      const encodedProject = encodeURIComponent(project);
      const diffUrl = `${host}/api/v4/projects/${encodedProject}/repository/commits/${sha}/diff`;
      const glDiffRes = await fetch(diffUrl, { method: 'GET', headers });

      if (!glDiffRes.ok) {
        return res.status(glDiffRes.status).json({
          error: `Não foi possível carregar as alterações do commit ${sha} no GitLab.`,
        });
      }

      const diffData = await glDiffRes.json();
      const files = (Array.isArray(diffData) ? diffData : []).map((d: any) => ({
        filename: d.new_path || d.old_path,
        status: d.new_file ? 'added' : d.deleted_file ? 'removed' : d.renamed_file ? 'renamed' : 'modified',
        additions: 0,
        deletions: 0,
        changes: 0,
        patch: d.diff ? d.diff.slice(0, 1000) : undefined,
      }));

      return res.json({
        sha,
        shortSha: sha.slice(0, 7),
        message: '',
        author: '',
        date: '',
        stats: { total: files.length, additions: 0, deletions: 0 },
        files,
        provider: 'gitlab',
      });
    }

    // GitHub commit detail & diff
    const rawRepo = repo || requestedProject || tenant?.github_repo;
    if (!rawRepo) {
      return res.status(400).json({ error: 'Repositório do GitHub é obrigatório' });
    }

    const cleanRepo = cleanGitHubRepo(rawRepo);
    const resolvedToken =
      (token && String(token).trim()) || tenant?.github_token || process.env.GITHUB_TOKEN || null;

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Cronos-Time-Tracker-App',
    };

    if (resolvedToken) {
      headers['Authorization'] = `Bearer ${resolvedToken}`;
    }

    const targetUrl = `https://api.github.com/repos/${cleanRepo}/commits/${sha}`;
    const ghResponse = await fetch(targetUrl, { method: 'GET', headers });

    if (!ghResponse.ok) {
      return res.status(ghResponse.status).json({
        error: `Não foi possível carregar os detalhes do commit ${sha} no GitHub.`,
      });
    }

    const data = await ghResponse.json();
    const files = (data.files || []).map((f: any) => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      changes: f.changes,
      patch: f.patch ? f.patch.slice(0, 1000) : undefined,
    }));

    return res.json({
      sha: data.sha,
      shortSha: data.sha?.slice(0, 7),
      message: data.commit?.message || '',
      author: data.commit?.author?.name || '',
      date: data.commit?.author?.date || '',
      stats: data.stats || { total: 0, additions: 0, deletions: 0 },
      files,
      provider: 'github',
    });
  } catch (err: any) {
    console.error('Git commit detail error:', err);
    res.status(500).json({ error: err.message || 'Falha ao buscar detalhes do commit' });
  }
});

// GET /api/git/allowed-repositories
// Returns the repositories currently authorized/selected for the tenant or a specific client
gitRouter.get('/allowed-repositories', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenant = req.tenant;
    if (!tenant) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    const clientId = (req.query.client_id || req.query.clientId) as string;
    if (clientId) {
      const client = await Client.findOne({
        where: { id: clientId, tenant_id: req.tenantId! },
      });
      if (client) {
        let repositories: any[] = [];
        if (client.allowed_repositories) {
          try {
            const parsed = JSON.parse(client.allowed_repositories);
            if (Array.isArray(parsed)) {
              repositories = parsed;
            }
          } catch {
            repositories = [];
          }
        }
        return res.json({
          repositories,
          client_id: client.id,
          client_name: client.name,
          git_provider: client.git_provider,
          default_repo: client.git_provider === 'gitlab' ? client.gitlab_project : client.github_repo,
        });
      }
    }

    let repositories: any[] = [];
    if (tenant.allowed_repositories) {
      try {
        const parsed = JSON.parse(tenant.allowed_repositories);
        if (Array.isArray(parsed)) {
          repositories = parsed;
        }
      } catch {
        repositories = [];
      }
    }

    return res.json({ repositories });
  } catch (err: any) {
    console.error('Error fetching allowed repositories:', err);
    res.status(500).json({ error: 'Erro ao obter repositórios autorizados' });
  }
});

// POST /api/git/allowed-repositories
// Saves the list of authorized repositories for the tenant or a specific client
gitRouter.post('/allowed-repositories', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenant = req.tenant;
    if (!tenant) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    const { repositories, client_id, clientId } = req.body || {};
    if (!Array.isArray(repositories)) {
      return res.status(400).json({ error: 'Lista de repositórios inválida' });
    }

    // Sanitize repository items
    const sanitized = repositories.map((r: any) => ({
      id: String(r.id || `${r.provider || 'git'}:${r.fullName || r.name || Date.now()}`),
      provider: r.provider === 'gitlab' ? 'gitlab' : 'github',
      fullName: String(r.fullName || r.name || '').trim(),
      name: String(r.name || r.fullName || '').trim(),
      owner: r.owner ? String(r.owner).trim() : undefined,
      projectId: r.projectId ? String(r.projectId).trim() : undefined,
      isPrivate: Boolean(r.isPrivate),
      description: r.description ? String(r.description).trim() : undefined,
      defaultBranch: r.defaultBranch ? String(r.defaultBranch).trim() : 'main',
      url: r.url ? String(r.url).trim() : undefined,
      gitlabUrl: r.gitlabUrl ? String(r.gitlabUrl).trim() : undefined,
      updatedAt: r.updatedAt ? String(r.updatedAt).trim() : undefined,
    }));

    const targetClientId = client_id || clientId;
    if (targetClientId) {
      const client = await Client.findOne({
        where: { id: targetClientId, tenant_id: req.tenantId! },
      });
      if (!client) {
        return res.status(404).json({ error: 'Cliente não encontrado' });
      }
      client.allowed_repositories = JSON.stringify(sanitized);
      await client.save();
      return res.json({ success: true, repositories: sanitized, client_id: targetClientId });
    }

    tenant.allowed_repositories = JSON.stringify(sanitized);
    await tenant.save();

    return res.json({ success: true, repositories: sanitized });
  } catch (err: any) {
    console.error('Error updating allowed repositories:', err);
    res.status(500).json({ error: 'Erro ao salvar repositórios autorizados' });
  }
});

// POST /api/git/list-repositories
// Queries GitHub or GitLab API using the token to list all accessible repositories
gitRouter.post('/list-repositories', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      provider: requestedProvider,
      token,
      gitlabUrl: requestedGitlabUrl,
      client_id: requestedClientId,
      clientId: requestedClientIdAlt,
    } = req.body || {};

    const tenant = req.tenant;

    const clientId = requestedClientId || requestedClientIdAlt;
    let targetClient: Client | null = null;
    if (clientId) {
      targetClient = await Client.findOne({
        where: { id: clientId, tenant_id: req.tenantId! },
      });
    }

    const provider: 'github' | 'gitlab' =
      requestedProvider === 'gitlab' ||
      (!requestedProvider && targetClient?.git_provider === 'gitlab') ||
      (!requestedProvider && !targetClient?.git_provider && tenant?.git_provider === 'gitlab')
        ? 'gitlab'
        : 'github';

    // ==========================================
    // GITLAB: List user's projects / groups
    // ==========================================
    if (provider === 'gitlab') {
      const resolvedToken =
        (token && String(token).trim()) ||
        targetClient?.gitlab_token ||
        tenant?.gitlab_token ||
        process.env.GITLAB_TOKEN ||
        null;

      if (!resolvedToken) {
        return res.status(400).json({
          error:
            'Personal Access Token (PAT) do GitLab é obrigatório para listar repositórios. Configure o token nas Configurações ou informe no formulário.',
        });
      }

      const defaultHost =
        requestedGitlabUrl || targetClient?.gitlab_url || tenant?.gitlab_url || 'https://gitlab.com';
      const host = String(defaultHost).trim().replace(/\/+$/, '');

      // Query projects where the user is a member
      const targetUrl = `${host}/api/v4/projects?membership=true&order_by=updated_at&sort=desc&per_page=100&simple=true`;

      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'PRIVATE-TOKEN': resolvedToken,
          'User-Agent': 'Cronos-Time-Tracker-App',
        },
      });

      if (!response.ok) {
        const status = response.status;
        let errMsg = `Falha ao listar projetos do GitLab (HTTP ${status}).`;
        if (status === 401) {
          errMsg = 'Token do GitLab inválido ou expirado. Verifique o escopo "read_api".';
        }
        return res.status(status).json({ error: errMsg });
      }

      const projectsData = await response.json();
      if (!Array.isArray(projectsData)) {
        return res.json({ provider: 'gitlab', repositories: [] });
      }

      const repositories = projectsData.map((p: any) => ({
        id: `gitlab:${p.id}`,
        provider: 'gitlab' as const,
        projectId: String(p.id),
        fullName: p.path_with_namespace || p.name_with_namespace || String(p.id),
        name: p.name || p.path,
        owner: p.namespace?.name || p.namespace?.path || '',
        isPrivate: p.visibility === 'private' || p.visibility === 'internal',
        description: p.description || '',
        defaultBranch: p.default_branch || 'main',
        url: p.web_url,
        gitlabUrl: host,
        updatedAt: p.last_activity_at || p.created_at,
      }));

      return res.json({ provider: 'gitlab', repositories });
    }

    // ==========================================
    // GITHUB: List user's repos & org repos
    // ==========================================
    const resolvedToken =
      (token && String(token).trim()) ||
      targetClient?.github_token ||
      tenant?.github_token ||
      process.env.GITHUB_TOKEN ||
      null;

    if (!resolvedToken) {
      return res.status(400).json({
        error:
          'Personal Access Token (PAT) do GitHub é obrigatório para listar repositórios privados e da organização. Configure o token nas Configurações ou informe no formulário.',
      });
    }

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Cronos-Time-Tracker-App',
      'Authorization': `Bearer ${resolvedToken}`,
    };

    // GitHub user repos: owner, collaborator, and org member
    const targetUrl = 'https://api.github.com/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator,organization_member';

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const status = response.status;
      let errMsg = `Falha ao listar repositórios do GitHub (HTTP ${status}).`;
      if (status === 401) {
        errMsg = 'Token do GitHub inválido ou expirado. Verifique os escopos "repo" ou "read:org".';
      }
      return res.status(status).json({ error: errMsg });
    }

    const reposData = await response.json();
    if (!Array.isArray(reposData)) {
      return res.json({ provider: 'github', repositories: [] });
    }

    const repositories = reposData.map((r: any) => ({
      id: `github:${r.full_name}`,
      provider: 'github' as const,
      fullName: r.full_name,
      name: r.name,
      owner: r.owner?.login || '',
      isPrivate: Boolean(r.private),
      description: r.description || '',
      defaultBranch: r.default_branch || 'main',
      url: r.html_url,
      updatedAt: r.updated_at,
    }));

    return res.json({ provider: 'github', repositories });
  } catch (err: any) {
    console.error('Error listing git repositories:', err);
    res.status(500).json({ error: err.message || 'Falha ao listar repositórios' });
  }
});

// POST /api/git/branches
// Lists branches from GitHub or GitLab for autocomplete
gitRouter.post('/branches', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      provider: requestedProvider,
      repo,
      project: requestedProject,
      gitlabUrl: requestedGitlabUrl,
      token,
      search = '',
      client_id: requestedClientId,
      clientId: requestedClientIdAlt,
    } = req.body || {};

    const tenant = req.tenant;
    const clientId = requestedClientId || requestedClientIdAlt;
    let targetClient: Client | null = null;
    if (clientId) {
      targetClient = await Client.findOne({
        where: { id: clientId, tenant_id: req.tenantId! },
      });
    }

    const provider: 'github' | 'gitlab' =
      requestedProvider === 'gitlab' ||
      (!requestedProvider && targetClient?.git_provider === 'gitlab') ||
      (!requestedProvider && !targetClient?.git_provider && tenant?.git_provider === 'gitlab')
        ? 'gitlab'
        : 'github';

    // GitLab Branches
    if (provider === 'gitlab') {
      const rawProject =
        requestedProject || repo || targetClient?.gitlab_project || tenant?.gitlab_project;
      if (!rawProject || !String(rawProject).trim()) {
        return res.status(400).json({ error: 'Projeto do GitLab é necessário para listar branches.' });
      }

      const defaultHost =
        requestedGitlabUrl || targetClient?.gitlab_url || tenant?.gitlab_url || 'https://gitlab.com';
      const { host, project } = parseGitLabTarget(rawProject, defaultHost);
      const resolvedToken =
        (token && String(token).trim()) ||
        targetClient?.gitlab_token ||
        tenant?.gitlab_token ||
        process.env.GITLAB_TOKEN ||
        null;

      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'User-Agent': 'Cronos-Time-Tracker-App',
      };
      if (resolvedToken) {
        headers['PRIVATE-TOKEN'] = resolvedToken;
      }

      const encodedProject = encodeURIComponent(project);
      const searchParam = search ? `&search=${encodeURIComponent(String(search).trim())}` : '';
      const targetUrl = `${host}/api/v4/projects/${encodedProject}/repository/branches?per_page=50${searchParam}`;

      const response = await fetch(targetUrl, { method: 'GET', headers });
      if (!response.ok) {
        return res.status(response.status).json({ error: 'Não foi possível carregar branches do GitLab.' });
      }

      const branchesData = await response.json();
      if (!Array.isArray(branchesData)) {
        return res.json({ provider: 'gitlab', branches: [] });
      }

      const branches = branchesData.map((b: any) => ({
        name: b.name,
        commitSha: b.commit?.short_id || (b.commit?.id ? b.commit.id.substring(0, 7) : ''),
        isDefault: Boolean(b.default),
        isProtected: Boolean(b.protected),
      }));

      return res.json({ provider: 'gitlab', branches });
    }

    // GitHub Branches
    const rawRepo = repo || targetClient?.github_repo || tenant?.github_repo;
    if (!rawRepo || !String(rawRepo).trim()) {
      return res.status(400).json({ error: 'Repositório GitHub é necessário para listar branches.' });
    }

    const cleanRepo = cleanGitHubRepo(rawRepo);
    if (!cleanRepo || !cleanRepo.includes('/')) {
      return res.status(400).json({ error: 'Formato de repositório inválido. Utilize "dono/repositório".' });
    }

    const resolvedToken =
      (token && String(token).trim()) ||
      targetClient?.github_token ||
      tenant?.github_token ||
      process.env.GITHUB_TOKEN ||
      null;

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Cronos-Time-Tracker-App',
    };
    if (resolvedToken) {
      headers['Authorization'] = `Bearer ${resolvedToken}`;
    }

    const targetUrl = `https://api.github.com/repos/${cleanRepo}/branches?per_page=100`;
    const response = await fetch(targetUrl, { method: 'GET', headers });

    if (!response.ok) {
      const status = response.status;
      let errMsg = `Falha ao listar branches do GitHub (HTTP ${status}).`;
      if (status === 404) {
        errMsg = 'Repositório não encontrado ou privado. Verifique se o token de acesso possui permissão.';
      } else if (status === 401) {
        errMsg = 'Token do GitHub inválido ou expirado.';
      }
      return res.status(status).json({ error: errMsg });
    }

    const branchesData = await response.json();
    if (!Array.isArray(branchesData)) {
      return res.json({ provider: 'github', branches: [] });
    }

    let branches = branchesData.map((b: any) => ({
      name: b.name,
      commitSha: b.commit?.sha ? b.commit.sha.substring(0, 7) : '',
      isProtected: Boolean(b.protected),
    }));

    if (search && String(search).trim()) {
      const q = String(search).trim().toLowerCase();
      branches = branches.filter((b) => b.name.toLowerCase().includes(q));
    }

    return res.json({ provider: 'github', branches });
  } catch (err: any) {
    console.error('Error listing git branches:', err);
    res.status(500).json({ error: err.message || 'Falha ao listar branches' });
  }
});
