import React, { useState } from 'react';
import {
  BookOpen,
  Key,
  Server,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  Terminal,
  ShieldCheck,
  FolderGit2,
  Lock,
  Globe,
} from 'lucide-react';
import { Dialog } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useToast } from './ui/toast';

interface GitCredentialsGuideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: 'github' | 'gitlab' | 'selfhosted' | 'terminal';
}

export function GitCredentialsGuideModal({
  open,
  onOpenChange,
  initialTab = 'github',
}: GitCredentialsGuideModalProps) {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'github' | 'gitlab' | 'selfhosted' | 'terminal'>(initialTab);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      setTimeout(() => setCopiedText(null), 2000);
      addToast({
        title: 'Copiado!',
        description: `${label} copiado para a área de transferência.`,
        variant: 'success',
      });
    } catch {
      addToast({
        title: 'Erro ao copiar',
        description: 'Não foi possível copiar o texto.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Guia de Integração Git: GitHub, GitLab e Self-Hosted"
      description="Como gerar tokens de acesso (PAT), encontrar identificadores de projetos e configurar suas credenciais com segurança."
      className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden"
    >
      {/* Header Tabs */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 px-6 pt-3 gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('github')}
          className={`flex items-center gap-2 pb-3 px-3 text-xs font-semibold border-b-2 transition whitespace-nowrap cursor-pointer ${
            activeTab === 'github'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>GitHub</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('gitlab')}
          className={`flex items-center gap-2 pb-3 px-3 text-xs font-semibold border-b-2 transition whitespace-nowrap cursor-pointer ${
            activeTab === 'gitlab'
              ? 'border-orange-600 text-orange-600 dark:text-orange-400'
              : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-orange-500" />
          <span>GitLab Cloud</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('selfhosted')}
          className={`flex items-center gap-2 pb-3 px-3 text-xs font-semibold border-b-2 transition whitespace-nowrap cursor-pointer ${
            activeTab === 'selfhosted'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>GitLab Self-Hosted</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('terminal')}
          className={`flex items-center gap-2 pb-3 px-3 text-xs font-semibold border-b-2 transition whitespace-nowrap cursor-pointer ${
            activeTab === 'terminal'
              ? 'border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100'
              : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Sem Token (Terminal)</span>
        </button>
      </div>

      {/* Content Body */}
      <div className="p-6 overflow-y-auto space-y-6 text-xs">
        {/* ========================================================================= */}
        {/* TAB: GITHUB */}
        {/* ========================================================================= */}
        {activeTab === 'github' && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4 p-4 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40">
              <div>
                <h4 className="font-semibold text-indigo-950 dark:text-indigo-200">
                  GitHub Personal Access Token (PAT)
                </h4>
                <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1">
                  O token permite ler os commits e arquivos dos seus repositórios privados e evita restrições de taxa na API pública do GitHub.
                </p>
              </div>
              <a
                href="https://github.com/settings/tokens"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition shrink-0 shadow-xs"
              >
                <span>Ir para GitHub Tokens</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="space-y-4">
              <h5 className="font-semibold text-neutral-900 dark:text-neutral-100 text-xs uppercase tracking-wider">
                Passo a Passo para Criar seu Token
              </h5>

              <ol className="space-y-3 text-xs text-neutral-700 dark:text-neutral-300">
                <li className="flex gap-3">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-bold shrink-0 text-2xs">
                    1
                  </span>
                  <div>
                    Acesse o GitHub, clique na sua foto de perfil no canto superior direito e vá em <strong>Settings</strong>.
                  </div>
                </li>

                <li className="flex gap-3">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-bold shrink-0 text-2xs">
                    2
                  </span>
                  <div>
                    No menu lateral esquerdo, role até o final e clique em <strong>&lt;&gt; Developer settings</strong>.
                  </div>
                </li>

                <li className="flex gap-3">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-bold shrink-0 text-2xs">
                    3
                  </span>
                  <div>
                    Em <strong>Personal access tokens</strong>, selecione <strong>Tokens (classic)</strong> e clique no botão <strong>Generate new token (classic)</strong>.
                  </div>
                </li>

                <li className="flex gap-3">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-bold shrink-0 text-2xs">
                    4
                  </span>
                  <div className="space-y-1.5">
                    <div>
                      Preencha o campo <strong>Note</strong> com um nome identificador (ex.: <code className="bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">Cronos AI Time Tracker</code>).
                    </div>
                    <div>
                      Defina a <strong>Expiration</strong> desejada (ex.: 90 dias ou No expiration para uso pessoal contínuo).
                    </div>
                  </div>
                </li>

                <li className="flex gap-3">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-bold shrink-0 text-2xs">
                    5
                  </span>
                  <div className="space-y-1">
                    <div>
                      Em <strong>Select scopes</strong>, marque:
                    </div>
                    <div className="p-2.5 rounded bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 font-mono text-2xs space-y-1">
                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>[x] repo (Full control of private repositories)</span>
                      </div>
                      <p className="text-neutral-500 dark:text-neutral-400 font-sans text-2xs ml-5">
                        * Necessário se você quiser ler commits de repositórios privados da sua organização ou conta. Para repositórios públicos, nenhum escopo é estritamente obrigatório.
                      </p>
                    </div>
                  </div>
                </li>

                <li className="flex gap-3">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-bold shrink-0 text-2xs">
                    6
                  </span>
                  <div>
                    Clique em <strong>Generate token</strong> no final da página. Copie o token iniciado por <code className="bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded text-indigo-600 dark:text-indigo-400">ghp_...</code> e cole no campo de token do Cronos.
                  </div>
                </li>
              </ol>
            </div>

            {/* Repositories Format Box */}
            <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 space-y-2">
              <div className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                <FolderGit2 className="w-3.5 h-3.5 text-indigo-500" />
                <span>Formato aceito para o campo Repositório:</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-2 text-2xs font-mono">
                <div className="p-2 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
                  <span>dono/projeto (ex: facebook/react)</span>
                  <button
                    type="button"
                    onClick={() => handleCopy('facebook/react', 'Exemplo')}
                    className="text-neutral-400 hover:text-indigo-600"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
                <div className="p-2 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
                  <span>URL completa: https://github.com/dono/projeto</span>
                  <button
                    type="button"
                    onClick={() => handleCopy('https://github.com/facebook/react', 'URL')}
                    className="text-neutral-400 hover:text-indigo-600"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: GITLAB CLOUD */}
        {/* ========================================================================= */}
        {activeTab === 'gitlab' && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4 p-4 rounded-lg bg-orange-50/50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/40">
              <div>
                <h4 className="font-semibold text-orange-950 dark:text-orange-200">
                  GitLab Cloud (gitlab.com) Access Token
                </h4>
                <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                  Permite buscar commits de projetos públicos, privados e repositórios de grupos do GitLab.com via API REST v4.
                </p>
              </div>
              <a
                href="https://gitlab.com/-/user_settings/personal_access_tokens"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-orange-600 text-white text-xs font-semibold hover:bg-orange-700 transition shrink-0 shadow-xs"
              >
                <span>Ir para GitLab Tokens</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="space-y-4">
              <h5 className="font-semibold text-neutral-900 dark:text-neutral-100 text-xs uppercase tracking-wider">
                Passo a Passo no GitLab.com
              </h5>

              <ol className="space-y-3 text-xs text-neutral-700 dark:text-neutral-300">
                <li className="flex gap-3">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-bold shrink-0 text-2xs">
                    1
                  </span>
                  <div>
                    Acesse o GitLab.com, clique no seu avatar no menu lateral ou canto superior e escolha <strong>Preferences</strong> (ou Edit profile).
                  </div>
                </li>

                <li className="flex gap-3">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-bold shrink-0 text-2xs">
                    2
                  </span>
                  <div>
                    No menu lateral esquerdo, clique em <strong>Access Tokens</strong>.
                  </div>
                </li>

                <li className="flex gap-3">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-bold shrink-0 text-2xs">
                    3
                  </span>
                  <div className="space-y-1">
                    <div>
                      Clique em <strong>Add new token</strong>.
                    </div>
                    <div>
                      Defina um nome descritivo (ex.: <code className="bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded">Cronos-App</code>) e a data de expiração.
                    </div>
                  </div>
                </li>

                <li className="flex gap-3">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-bold shrink-0 text-2xs">
                    4
                  </span>
                  <div className="space-y-1.5">
                    <div>
                      Em <strong>Select scopes</strong>, selecione:
                    </div>
                    <div className="p-2.5 rounded bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 font-mono text-2xs space-y-1">
                      <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>[x] read_api</span>
                        <span className="text-neutral-500 font-sans font-normal">(Recomendado - permite listar commits e diffs)</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>[x] read_repository</span>
                        <span className="text-neutral-500 font-sans font-normal">(Alternativa para leitura exclusiva de repositórios)</span>
                      </div>
                    </div>
                  </div>
                </li>

                <li className="flex gap-3">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-bold shrink-0 text-2xs">
                    5
                  </span>
                  <div>
                    Clique em <strong>Create personal access token</strong>. Copie o token gerado (<code className="bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded text-orange-600 dark:text-orange-400">glpat-...</code>) e salve nas Configurações do Cronos.
                  </div>
                </li>
              </ol>
            </div>

            {/* GitLab Project Identification */}
            <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 space-y-2">
              <div className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                <FolderGit2 className="w-3.5 h-3.5 text-orange-500" />
                <span>Como preencher o campo de Projeto no GitLab:</span>
              </div>
              <ul className="text-2xs text-neutral-600 dark:text-neutral-300 space-y-1 list-disc list-inside">
                <li><strong>Caminho do Projeto:</strong> <code className="font-mono bg-white dark:bg-neutral-800 px-1 rounded">grupo/projeto</code> ou <code className="font-mono bg-white dark:bg-neutral-800 px-1 rounded">grupo/subgrupo/projeto</code></li>
                <li><strong>URL Completa:</strong> <code className="font-mono bg-white dark:bg-neutral-800 px-1 rounded">https://gitlab.com/meu-grupo/meu-projeto</code> (o sistema extrai o caminho automaticamente)</li>
                <li><strong>ID Numérico do Projeto:</strong> Se preferir, use o Project ID que fica visível na página principal do projeto logo abaixo do nome (ex.: <code className="font-mono bg-white dark:bg-neutral-800 px-1 rounded">278964</code>)</li>
              </ul>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: GITLAB SELF-HOSTED (ON-PREMISES) */}
        {/* ========================================================================= */}
        {activeTab === 'selfhosted' && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4 p-4 rounded-lg bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40">
              <div>
                <h4 className="font-semibold text-purple-950 dark:text-purple-200 flex items-center gap-2">
                  <Server className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>GitLab Self-Hosted (Servidor Corporativo / On-Premise)</span>
                </h4>
                <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                  Funciona com qualquer instalação comunitária (CE) ou corporativa (EE) do GitLab rodando em infraestrutura própria, VPS, Kubernetes ou VPN interna.
                </p>
              </div>
              <Badge variant="secondary" className="bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200 text-2xs border-purple-300 dark:border-purple-700 shrink-0">
                API REST v4
              </Badge>
            </div>

            <div className="space-y-4">
              <h5 className="font-semibold text-neutral-900 dark:text-neutral-100 text-xs uppercase tracking-wider">
                Como Configurar a sua Instância Self-Hosted
              </h5>

              <ol className="space-y-3.5 text-xs text-neutral-700 dark:text-neutral-300">
                <li className="flex gap-3">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-bold shrink-0 text-2xs">
                    1
                  </span>
                  <div className="space-y-1.5 flex-1">
                    <strong className="text-neutral-900 dark:text-neutral-100">1. URL da Instância:</strong>
                    <p className="text-neutral-600 dark:text-neutral-400">
                      Insira a URL base exatamente como você acessa no navegador, incluindo o protocolo (<code className="font-mono bg-neutral-100 dark:bg-neutral-800 px-1">https://</code> ou <code className="font-mono bg-neutral-100 dark:bg-neutral-800 px-1">http://</code>) e a porta se houver, sem barra no final.
                    </p>
                    <div className="p-2 rounded bg-neutral-100 dark:bg-neutral-850 font-mono text-2xs text-purple-700 dark:text-purple-300 space-y-0.5">
                      <div>Exemplos comuns:</div>
                      <div>• https://gitlab.suaempresa.com.br</div>
                      <div>• https://git.corp.local</div>
                      <div>• http://192.168.1.50:8080</div>
                    </div>
                  </div>
                </li>

                <li className="flex gap-3">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-bold shrink-0 text-2xs">
                    2
                  </span>
                  <div className="space-y-1.5 flex-1">
                    <strong className="text-neutral-900 dark:text-neutral-100">2. Onde Gerar o Token no seu Servidor:</strong>
                    <p className="text-neutral-600 dark:text-neutral-400">
                      Acesse diretamente pelo navegador no seu servidor:
                    </p>
                    <div className="p-2 rounded bg-neutral-900 text-emerald-400 font-mono text-2xs flex items-center justify-between">
                      <code>https://SEU_GITLAB/-/user_settings/personal_access_tokens</code>
                      <button
                        type="button"
                        onClick={() => handleCopy('https://SEU_GITLAB/-/user_settings/personal_access_tokens', 'URL de Token')}
                        className="text-neutral-400 hover:text-white"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-neutral-500 text-2xs">
                      Ou clique no seu avatar &gt; <strong>Preferences</strong> &gt; <strong>Access Tokens</strong>. Marque os escopos <code className="font-semibold text-neutral-800 dark:text-neutral-200">read_api</code> ou <code className="font-semibold text-neutral-800 dark:text-neutral-200">read_repository</code>.
                    </p>
                  </div>
                </li>

                <li className="flex gap-3">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-bold shrink-0 text-2xs">
                    3
                  </span>
                  <div className="space-y-1.5 flex-1">
                    <strong className="text-neutral-900 dark:text-neutral-100">3. Opção Recomendada: Project Access Token (Por Projeto):</strong>
                    <p className="text-neutral-600 dark:text-neutral-400">
                      Se você preferir não criar um token com acesso a todos os seus projetos pessoais, o GitLab Self-Hosted permite gerar um token restrito a um único repositório:
                    </p>
                    <p className="text-neutral-600 dark:text-neutral-400 text-2xs">
                      No GitLab, abra o repositório &gt; <strong>Settings</strong> &gt; <strong>Access Tokens</strong> &gt; Clique em <strong>Add new token</strong> &gt; Selecione Role <code className="font-mono bg-neutral-100 dark:bg-neutral-800 px-1">Reporter</code> e Escopo <code className="font-mono bg-neutral-100 dark:bg-neutral-800 px-1">read_repository</code>.
                    </p>
                  </div>
                </li>

                <li className="flex gap-3">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-bold shrink-0 text-2xs">
                    4
                  </span>
                  <div className="space-y-1.5 flex-1">
                    <strong className="text-neutral-900 dark:text-neutral-100">4. Como identificar o Projeto / Repositório:</strong>
                    <div className="p-3 rounded bg-neutral-100 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 text-2xs space-y-1.5">
                      <div className="flex items-center gap-1.5 font-semibold text-neutral-800 dark:text-neutral-200">
                        <FolderGit2 className="w-3.5 h-3.5 text-purple-600" />
                        <span>Duas formas aceitas:</span>
                      </div>
                      <div>
                        <strong>A) Caminho completo com grupos:</strong> <code className="bg-white dark:bg-neutral-900 px-1 py-0.5 rounded font-mono">financeiro/core/faturamento-api</code>
                      </div>
                      <div>
                        <strong>B) ID Numérico (Muito mais simples!):</strong> Na página principal do projeto no GitLab, logo abaixo do título há o texto <code className="bg-white dark:bg-neutral-900 px-1 py-0.5 rounded font-mono">Project ID: 412</code>. Você pode colocar apenas o número <code className="bg-white dark:bg-neutral-900 px-1 py-0.5 rounded font-mono">412</code> no campo de projeto!
                      </div>
                    </div>
                  </div>
                </li>
              </ol>
            </div>

            <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 text-xs text-amber-900 dark:text-amber-200 flex gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-2xs">
                <strong>Dica de Rede &amp; Firewall:</strong>
                <p>
                  Como a consulta aos commits é executada de forma segura pelo servidor backend do Cronos, a URL da sua instância GitLab precisa ser acessível pela internet ou pela rota de rede em que a aplicação está executando.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: SEM TOKEN (TERMINAL GIT) */}
        {/* ========================================================================= */}
        {activeTab === 'terminal' && (
          <div className="space-y-5">
            <div className="p-4 rounded-lg bg-neutral-100 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800">
              <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-500" />
                <span>Sem Token / Totalmente Universal (Via Terminal Git)</span>
              </h4>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                Não quer criar tokens ou o repositório está em uma rede isolada? Você pode simplesmente copiar a saída do terminal do seu Git local e colar na aba <strong>&quot;Diff Manual&quot;</strong>. A inteligência artificial irá extrair e sugerir todas as tarefas da mesma forma!
              </p>
            </div>

            <div className="space-y-3">
              <h5 className="font-semibold text-neutral-900 dark:text-neutral-100 text-xs uppercase tracking-wider">
                Comandos Prontos para Executar no seu Terminal
              </h5>

              <div className="space-y-2.5">
                <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-900 text-neutral-100 space-y-1.5">
                  <div className="flex items-center justify-between text-2xs text-neutral-400">
                    <span className="font-semibold text-neutral-200">1. Últimos 5 Commits Detalhados (Recomendado):</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopy('git log -n 5', 'Comando git log')}
                      className="h-6 px-2 text-2xs text-neutral-300 hover:text-white hover:bg-neutral-800"
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      <span>Copiar</span>
                    </Button>
                  </div>
                  <div className="font-mono text-xs text-emerald-400 bg-neutral-950 p-2 rounded select-all">
                    git log -n 5
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-900 text-neutral-100 space-y-1.5">
                  <div className="flex items-center justify-between text-2xs text-neutral-400">
                    <span className="font-semibold text-neutral-200">2. Apenas Mensagens dos Últimos 10 Commits:</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopy('git log -n 10 --pretty=format:"%s"', 'Comando format')}
                      className="h-6 px-2 text-2xs text-neutral-300 hover:text-white hover:bg-neutral-800"
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      <span>Copiar</span>
                    </Button>
                  </div>
                  <div className="font-mono text-xs text-emerald-400 bg-neutral-950 p-2 rounded select-all">
                    git log -n 10 --pretty=format:&quot;%s&quot;
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-900 text-neutral-100 space-y-1.5">
                  <div className="flex items-center justify-between text-2xs text-neutral-400">
                    <span className="font-semibold text-neutral-200">3. Patch / Diff Estatístico das Últimas Alterações:</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopy('git diff HEAD~1 HEAD --stat -p', 'Comando git diff')}
                      className="h-6 px-2 text-2xs text-neutral-300 hover:text-white hover:bg-neutral-800"
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      <span>Copiar</span>
                    </Button>
                  </div>
                  <div className="font-mono text-xs text-emerald-400 bg-neutral-950 p-2 rounded select-all">
                    git diff HEAD~1 HEAD --stat -p
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Footer */}
      <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Os tokens são armazenados com segurança no banco de dados do seu workspace.</span>
        </div>
        <Button
          type="button"
          onClick={() => onOpenChange(false)}
          className="h-8 px-4 text-xs font-semibold cursor-pointer"
        >
          Entendi, Fechar Guia
        </Button>
      </div>
    </Dialog>
  );
}
