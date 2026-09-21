import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Clock,
  FileText,
  BarChart3,
  History,
  Briefcase,
  Bot,
  Settings,
  Plus,
  Play,
  Square,
  Moon,
  Sun,
  Keyboard,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Client, TimeSession } from '../types';

export interface CommandPaletteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (tab: string) => void;
  onToggleTimer: () => void;
  onNewNote: () => void;
  onNewClient: () => void;
  onToggleTheme: () => void;
  onOpenShortcutsHelp: () => void;
  activeSession: TimeSession | null;
  clients: Client[];
  theme: 'light' | 'dark';
}

interface PaletteAction {
  id: string;
  title: string;
  subtitle?: string;
  category: 'Navegação' | 'Ações do Cronômetro' | 'Criação' | 'Preferências';
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  run: () => void;
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
  clients,
  theme,
}: CommandPaletteModalProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input on open & reset state
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [open]);

  // Define commands
  const allActions: PaletteAction[] = [
    // Navigation
    {
      id: 'nav-timer',
      title: 'Ir para Cronômetro',
      subtitle: 'Controle de tempo em andamento e metas',
      category: 'Navegação',
      icon: Clock,
      run: () => onNavigate('timer'),
    },
    {
      id: 'nav-notes',
      title: 'Ir para Notas & TODO',
      subtitle: 'Checklists, rascunhos e anotações ricas',
      category: 'Navegação',
      icon: FileText,
      run: () => onNavigate('notes'),
    },
    {
      id: 'nav-reports',
      title: 'Ir para Relatórios',
      subtitle: 'Faturamento, métricas e links compartilháveis',
      category: 'Navegação',
      icon: BarChart3,
      run: () => onNavigate('reports'),
    },
    {
      id: 'nav-history',
      title: 'Ir para Histórico',
      subtitle: 'Visualizar e editar sessões registradas',
      category: 'Navegação',
      icon: History,
      run: () => onNavigate('history'),
    },
    {
      id: 'nav-clients',
      title: 'Ir para Clientes',
      subtitle: 'Gerenciar empresas, projetos e contatos',
      category: 'Navegação',
      icon: Briefcase,
      run: () => onNavigate('clients'),
    },
    {
      id: 'nav-assistant',
      title: 'Ir para Assistente Cronos AI',
      subtitle: 'Comandos em linguagem natural e automações',
      category: 'Navegação',
      icon: Bot,
      run: () => onNavigate('assistant'),
    },
    {
      id: 'nav-settings',
      title: 'Ir para Configurações',
      subtitle: 'Workspace, membros, faturamento e integrações',
      category: 'Navegação',
      icon: Settings,
      run: () => onNavigate('settings'),
    },

    // Timer actions
    {
      id: 'timer-toggle',
      title: activeSession ? 'Finalizar Sessão Ativa' : 'Iniciar Novo Cronômetro',
      subtitle: activeSession
        ? `Parar cronômetro em andamento (${activeSession.title || 'Sem título'})`
        : 'Começar a contar o tempo de trabalho agora',
      category: 'Ações do Cronômetro',
      icon: activeSession ? Square : Play,
      shortcut: 'Alt + S',
      run: onToggleTimer,
    },

    // Creation actions
    {
      id: 'create-note',
      title: 'Criar Nova Nota / Checklist',
      subtitle: 'Adicionar documento com suporte a Markdown',
      category: 'Criação',
      icon: Plus,
      run: onNewNote,
    },
    {
      id: 'create-client',
      title: 'Cadastrar Novo Cliente',
      subtitle: 'Registrar nova empresa ou contrato',
      category: 'Criação',
      icon: Briefcase,
      run: onNewClient,
    },

    // Preferences
    {
      id: 'toggle-theme',
      title: theme === 'dark' ? 'Mudar para Tema Claro' : 'Mudar para Tema Escuro',
      subtitle: 'Alternar esquema de cores visual da interface',
      category: 'Preferências',
      icon: theme === 'dark' ? Sun : Moon,
      run: onToggleTheme,
    },
    {
      id: 'help-shortcuts',
      title: 'Ver Atalhos de Teclado',
      subtitle: 'Exibir todos os comandos e combinações rápidas',
      category: 'Preferências',
      icon: Keyboard,
      shortcut: '?',
      run: onOpenShortcutsHelp,
    },
  ];

  // Also include client quick jump
  if (clients && clients.length > 0) {
    clients.forEach((c) => {
      allActions.push({
        id: `client-${c.id}`,
        title: `Cliente: ${c.name}`,
        subtitle: `Ver detalhes e contatos de ${c.name}`,
        category: 'Navegação',
        icon: Briefcase,
        run: () => onNavigate('clients'),
      });
    });
  }

  // Filter actions based on query
  const filteredActions = allActions.filter((item) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase().trim();
    return (
      item.title.toLowerCase().includes(q) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
      item.category.toLowerCase().includes(q)
    );
  });

  // Handle keyboard navigation inside the palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filteredActions.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredActions.length) % (filteredActions.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredActions[selectedIndex]) {
        filteredActions[selectedIndex].run();
        onOpenChange(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onOpenChange(false);
    }
  };

  // Scroll active item into view
  useEffect(() => {
    const listEl = listRef.current;
    if (!listEl) return;
    const activeEl = listEl.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-xl rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-neutral-200 dark:border-neutral-800">
          <Search className="w-5 h-5 text-neutral-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Digite um comando, aba ou cliente... (ex: cronômetro, notas, faturamento)"
            className="flex-1 bg-transparent text-sm font-medium text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-2xs font-mono font-medium text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 rounded border border-neutral-200 dark:border-neutral-700">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div ref={listRef} className="overflow-y-auto p-2 space-y-1 flex-1">
          {filteredActions.length > 0 ? (
            filteredActions.map((action, idx) => {
              const isSelected = idx === selectedIndex;
              const Icon = action.icon;

              return (
                <button
                  key={action.id}
                  data-index={idx}
                  type="button"
                  onClick={() => {
                    action.run();
                    onOpenChange(false);
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100'
                      : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-md shrink-0 ${
                        isSelected
                          ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate text-neutral-900 dark:text-neutral-100">
                        {action.title}
                      </div>
                      {action.subtitle && (
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                          {action.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pl-2">
                    {action.shortcut && (
                      <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-medium rounded bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300">
                        {action.shortcut}
                      </kbd>
                    )}
                    {isSelected && (
                      <ArrowRight className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    )}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="py-8 text-center text-xs text-neutral-500 dark:text-neutral-400">
              Nenhum comando encontrado para &quot;{query}&quot;
            </div>
          )}
        </div>

        {/* Footer Navigation Bar */}
        <div className="px-4 py-2 border-t border-neutral-100 dark:border-neutral-800/80 bg-neutral-50 dark:bg-neutral-950/40 flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 font-mono text-[10px] bg-neutral-200 dark:bg-neutral-800 rounded">↑</kbd>
              <kbd className="px-1 py-0.5 font-mono text-[10px] bg-neutral-200 dark:bg-neutral-800 rounded">↓</kbd>
              <span>Navegar</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 font-mono text-[10px] bg-neutral-200 dark:bg-neutral-800 rounded">Enter</kbd>
              <span>Executar</span>
            </span>
          </div>
          <div>
            <span className="text-2xs text-neutral-400">Cronos Quick Command</span>
          </div>
        </div>
      </div>
    </div>
  );
}
