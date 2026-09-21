import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Clock,
  Briefcase,
  BarChart3,
  FileText,
  Sparkles,
  Settings,
  Plus,
  Moon,
  Sun,
  ArrowRight,
  Command as CmdIcon,
  Play,
  HelpCircle,
} from 'lucide-react';
import { Tenant, Client, TimeSession } from '../types';

interface CommandPaletteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (tab: string) => void;
  onToggleTimer?: () => void;
  onNewNote?: () => void;
  onNewClient?: () => void;
  onToggleTheme?: () => void;
  onOpenShortcutsHelp?: () => void;
  activeSession?: TimeSession | null;
  clients?: Client[];
  theme?: string;
  workspaces?: Tenant[];
  currentWorkspaceId?: string;
  onSwitchWorkspace?: (id: string) => void;
}

interface CommandItem {
  id: string;
  label: string;
  category: string;
  icon: React.ElementType;
  action: () => void;
  keywords: string;
}

export function CommandPaletteModal({
  open,
  onOpenChange,
  onNavigate,
  onToggleTimer,
  onNewNote,
  onNewClient,
  onToggleTheme,
  onOpenShortcutsHelp,
  activeSession,
  clients = [],
  theme = 'light',
  workspaces = [],
  currentWorkspaceId,
  onSwitchWorkspace,
}: CommandPaletteModalProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const isDarkMode = theme === 'dark';

  const commands: CommandItem[] = [
    {
      id: 'nav-timer',
      label: 'Ir para Timer / Sessão Ativa',
      category: 'Navegação',
      icon: Clock,
      action: () => {
        onNavigate('timer');
        onOpenChange(false);
      },
      keywords: 'timer cronometro relogio sessao',
    },
    {
      id: 'nav-history',
      label: 'Ver Histórico de Sessões',
      category: 'Navegação',
      icon: Clock,
      action: () => {
        onNavigate('history');
        onOpenChange(false);
      },
      keywords: 'historico sessoes relatorio passado',
    },
    {
      id: 'nav-clients',
      label: 'Gerenciar Clientes & Projetos',
      category: 'Navegação',
      icon: Briefcase,
      action: () => {
        onNavigate('clients');
        onOpenChange(false);
      },
      keywords: 'clientes projetos faturamento',
    },
    {
      id: 'nav-reports',
      label: 'Abrir Relatórios Faturáveis',
      category: 'Navegação',
      icon: BarChart3,
      action: () => {
        onNavigate('reports');
        onOpenChange(false);
      },
      keywords: 'relatorios graficos faturamento financas',
    },
    {
      id: 'nav-notes',
      label: 'Bloco de Notas & TODOs (Rich Text)',
      category: 'Navegação',
      icon: FileText,
      action: () => {
        if (onNewNote) onNewNote();
        onNavigate('notes');
        onOpenChange(false);
      },
      keywords: 'notas bloco de notas rascunho tarefas',
    },
    {
      id: 'nav-assistant',
      label: 'Assistente Cronos AI',
      category: 'IA & Inteligência',
      icon: Sparkles,
      action: () => {
        onNavigate('assistant');
        onOpenChange(false);
      },
      keywords: 'ai assistente gemini inteligencia',
    },
    {
      id: 'action-toggle-timer',
      label: activeSession ? 'Pausar / Parar Timer Atual' : 'Iniciar Novo Timer',
      category: 'Ações Rápidas',
      icon: Play,
      action: () => {
        if (onToggleTimer) onToggleTimer();
        onOpenChange(false);
      },
      keywords: 'timer iniciar parar pausar',
    },
    {
      id: 'action-new-client',
      label: 'Cadastrar Novo Cliente',
      category: 'Ações Rápidas',
      icon: Plus,
      action: () => {
        if (onNewClient) onNewClient();
        onOpenChange(false);
      },
      keywords: 'novo cliente cadastrar criar',
    },
    {
      id: 'action-theme',
      label: isDarkMode ? 'Mudar para Tema Claro' : 'Mudar para Tema Escuro',
      category: 'Preferências',
      icon: isDarkMode ? Sun : Moon,
      action: () => {
        if (onToggleTheme) onToggleTheme();
        onOpenChange(false);
      },
      keywords: 'tema escuro claro dark light modo',
    },
    {
      id: 'action-shortcuts',
      label: 'Ver Atalhos de Teclado',
      category: 'Ajuda',
      icon: HelpCircle,
      action: () => {
        if (onOpenShortcutsHelp) onOpenShortcutsHelp();
        onOpenChange(false);
      },
      keywords: 'atalhos keyboard shortcuts ajuda',
    },
    {
      id: 'nav-settings',
      label: 'Configurações do Workspace',
      category: 'Configurações',
      icon: Settings,
      action: () => {
        onNavigate('settings');
        onOpenChange(false);
      },
      keywords: 'configuracoes preferencias workspace',
    },
  ];

  workspaces.forEach((ws) => {
    if (ws.id !== currentWorkspaceId && onSwitchWorkspace) {
      commands.push({
        id: `switch-ws-${ws.id}`,
        label: `Mudar para Workspace: ${ws.name}`,
        category: 'Workspaces',
        icon: Briefcase,
        action: () => {
          onSwitchWorkspace(ws.id);
          onOpenChange(false);
        },
        keywords: `workspace empresa trocar ${ws.name}`,
      });
    }
  });

  const filteredCommands = commands.filter((cmd) => {
    const q = query.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q) ||
      cmd.keywords.includes(q)
    );
  });

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
      e.preventDefault();
      filteredCommands[selectedIndex].action();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onOpenChange(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-start justify-center pt-[15vh] px-4 animate-in fade-in duration-150"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 gap-3">
          <Search className="w-5 h-5 text-neutral-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Digite um comando ou navegue... (Ex: Novo Cliente, Relatórios)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 outline-hidden border-0 focus:ring-0"
          />
          <div className="flex items-center gap-1 shrink-0 text-2xs text-neutral-400 font-mono bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded-md border border-neutral-200 dark:border-neutral-700">
            <span>ESC</span>
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-xs text-neutral-400">
              Nenhum comando encontrado para &quot;{query}&quot;
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const Icon = cmd.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={cmd.id}
                  type="button"
                  onClick={cmd.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white font-medium shadow-2xs'
                      : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`p-1.5 rounded-lg shrink-0 ${
                        isSelected
                          ? 'bg-indigo-700 text-white'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="text-left truncate">
                      <p className="truncate font-medium">{cmd.label}</p>
                      <p
                        className={`text-2xs ${
                          isSelected ? 'text-indigo-200' : 'text-neutral-400 dark:text-neutral-500'
                        }`}
                      >
                        {cmd.category}
                      </p>
                    </div>
                  </div>
                  <ArrowRight
                    className={`w-3.5 h-3.5 shrink-0 ml-2 ${
                      isSelected ? 'text-indigo-200' : 'text-neutral-300 dark:text-neutral-700'
                    }`}
                  />
                </button>
              );
            })
          )}
        </div>

        <div className="px-4 py-2.5 bg-neutral-50 dark:bg-neutral-950/60 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-2xs text-neutral-400">
          <div className="flex items-center gap-2">
            <span>Use <kbd className="font-mono bg-neutral-200 dark:bg-neutral-800 px-1 py-0.5 rounded">↑</kbd> <kbd className="font-mono bg-neutral-200 dark:bg-neutral-800 px-1 py-0.5 rounded">↓</kbd> para navegar</span>
            <span>•</span>
            <span><kbd className="font-mono bg-neutral-200 dark:bg-neutral-800 px-1 py-0.5 rounded">Enter</kbd> para selecionar</span>
          </div>
          <div className="flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400">
            <CmdIcon className="w-3 h-3" />
            <span>Cronos Command Center</span>
          </div>
        </div>
      </div>
    </div>
  );
}
