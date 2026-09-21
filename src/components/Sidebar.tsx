import React, { useState, useEffect } from 'react';
import {
  Clock,
  BarChart3,
  History,
  Briefcase,
  FileText,
  Sparkles,
  Settings,
  Users,
  Moon,
  Sun,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutGrid,
  User as UserIcon,
  Search,
  Keyboard,
} from 'lucide-react';
import { User, Tenant, TimeSession } from '../types';
import { Button } from './ui/button';
import { WorkspaceSelector } from './WorkspaceSelector';

export type SidebarMode = 'full' | 'icons';

interface SidebarProps {
  activeTab: 'timer' | 'reports' | 'history' | 'clients' | 'notes' | 'settings' | 'assistant' | 'linked-clients';
  setActiveTab: (tab: 'timer' | 'reports' | 'history' | 'clients' | 'notes' | 'settings' | 'assistant' | 'linked-clients') => void;
  user: User | null;
  tenant: Tenant | null;
  activeSession: TimeSession | null;
  onOpenAuth: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onWorkspaceChange?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenShortcutsHelp?: () => void;
}

export function Sidebar({
  activeTab,
  setActiveTab,
  user,
  tenant,
  activeSession,
  onOpenAuth,
  theme,
  onToggleTheme,
  onWorkspaceChange,
  onOpenCommandPalette,
  onOpenShortcutsHelp,
}: SidebarProps) {
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cronos_sidebar_mode') as SidebarMode;
      if (saved && ['full', 'icons'].includes(saved)) return saved;
    }
    return 'full';
  });

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('cronos_sidebar_mode', sidebarMode);
    }
  }, [sidebarMode]);

  const cycleSidebarMode = () => {
    setSidebarMode(sidebarMode === 'full' ? 'icons' : 'full');
  };

  interface NavItem {
    id: 'timer' | 'reports' | 'history' | 'clients' | 'notes' | 'assistant' | 'linked-clients' | 'settings';
    label: string;
    icon: any;
    badge?: boolean;
    highlight?: boolean;
    ai?: boolean;
  }

  const navItems: NavItem[] = [
    { id: 'timer', label: 'Cronômetro', icon: Clock, badge: activeSession ? true : false },
    { id: 'reports', label: 'Relatórios', icon: BarChart3 },
    { id: 'history', label: 'Histórico', icon: History },
    { id: 'clients', label: 'Clientes', icon: Briefcase },
    { id: 'notes', label: 'Notas & TODO', icon: FileText, highlight: true },
    { id: 'assistant', label: 'Cronos AI', icon: Sparkles, ai: true },
    { id: 'linked-clients', label: 'Vínculos & Equipe', icon: Users },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  const handleTabClick = (tab: any) => {
    setActiveTab(tab);
    setMobileDrawerOpen(false);
  };

  return (
    <>
      {/* Mobile Top Header bar */}
      <header className="md:hidden sticky top-0 z-40 w-full h-16 border-b border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xs px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 shadow-xs">
            <Clock className="h-5 w-5" />
          </div>
          <span className="font-bold text-neutral-900 dark:text-neutral-100">Time Tracking</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-100"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setMobileDrawerOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-100"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      {mobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-start">
          <div className="w-80 bg-white dark:bg-neutral-900 h-full shadow-2xl flex flex-col p-4 border-r border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900">
                  <Clock className="h-4 w-4" />
                </div>
                <span className="font-bold text-neutral-900 dark:text-neutral-100">Menu Cronos</span>
              </div>
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Workspace selector on mobile */}
            <div className="py-3 border-b border-neutral-200 dark:border-neutral-800">
              <span className="text-2xs font-semibold text-neutral-400 uppercase tracking-wider block mb-1.5">Workspace Ativo</span>
              <WorkspaceSelector onWorkspaceChange={onWorkspaceChange} />
            </div>

            {/* Nav items mobile */}
            <div className="flex-1 overflow-y-auto py-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id || (item.id === 'clients' && activeTab.startsWith('client-'));
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabClick(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
                      isActive
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                        : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${item.highlight ? 'text-indigo-500' : ''}`} />
                    <span className="flex-1">{item.label}</span>
                    {item.badge && <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />}
                  </button>
                );
              })}
            </div>

            {/* User footer mobile */}
            <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800">
              {user ? (
                <button
                  onClick={() => { setMobileDrawerOpen(false); onOpenAuth(); }}
                  className="w-full flex items-center gap-3 p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-750 transition-colors text-left"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-bold text-xs">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">{user.name}</p>
                    <p className="text-2xs text-neutral-500 truncate">{tenant?.name || 'Workspace'}</p>
                  </div>
                </button>
              ) : (
                <Button onClick={() => { setMobileDrawerOpen(false); onOpenAuth(); }} className="w-full">
                  Entrar na Conta
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Desktop Lateral Sidebar */}
      <aside
        className={`hidden md:flex flex-col shrink-0 transition-all duration-300 border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 z-30 relative`}
        style={{
          width: sidebarMode === 'full' ? '256px' : '72px',
        }}
      >
        {/* Sidebar Header: Brand */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 shadow-xs shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            {sidebarMode === 'full' && (
              <span className="font-bold text-neutral-900 dark:text-neutral-100 text-sm tracking-tight truncate">
                Time Tracking
              </span>
            )}
          </div>
        </div>

        {/* Absolute Mode Toggle Button positioned outside on the right edge */}
        <button
          onClick={cycleSidebarMode}
          className="absolute -right-3.5 top-4.5 h-7 w-7 rounded-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-750 transition-colors shadow-md z-40 cursor-pointer"
          title={
            sidebarMode === 'full'
              ? 'Mudar para Somente Ícones'
              : 'Mudar para Completa'
          }
        >
          {sidebarMode === 'full' ? (
            <PanelLeftClose className="h-3.5 w-3.5" />
          ) : (
            <PanelLeftOpen className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Workspace selector if full */}
        {sidebarMode === 'full' && (
          <div className="p-3 border-b border-neutral-200 dark:border-neutral-800">
            <span className="text-2xs font-semibold text-neutral-400 uppercase tracking-wider block mb-1.5 px-1">Workspace</span>
            <WorkspaceSelector onWorkspaceChange={onWorkspaceChange} />
          </div>
        )}

        {/* Quick Search / Command Palette button */}
        {onOpenCommandPalette && (
          <div className="px-3 pt-2">
            <button
              onClick={onOpenCommandPalette}
              title={sidebarMode !== 'full' ? 'Buscar / Comandos (Ctrl + K)' : undefined}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-neutral-600 dark:text-neutral-400 bg-neutral-100/70 dark:bg-neutral-800/50 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 transition-colors cursor-pointer border border-neutral-200/50 dark:border-neutral-700/50 ${
                sidebarMode !== 'full' ? 'justify-center px-2' : 'justify-between'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Search className="h-4 w-4 shrink-0 text-neutral-500 dark:text-neutral-400" />
                {sidebarMode === 'full' && (
                  <span className="truncate">Comandos</span>
                )}
              </div>
              {sidebarMode === 'full' && (
                <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 shadow-2xs">
                  ⌘K
                </kbd>
              )}
            </button>
          </div>
        )}

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id || (item.id === 'clients' && activeTab.startsWith('client-'));
            const isCompact = sidebarMode !== 'full';

            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                title={isCompact ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-colors relative group/item cursor-pointer ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-semibold shadow-2xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800/60 hover:text-neutral-900 dark:hover:text-neutral-100'
                } ${isCompact ? 'justify-center px-2' : ''}`}
              >
                <div className="relative shrink-0">
                  <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${item.highlight ? 'text-indigo-500' : ''} ${item.ai ? 'text-indigo-600 dark:text-indigo-400 animate-pulse' : ''}`} />
                  {item.badge && (
                    <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  )}
                </div>

                {sidebarMode === 'full' && (
                  <span className="truncate flex-1 text-left">{item.label}</span>
                )}

                {/* Tooltip for compact mode */}
                {isCompact && (
                  <div className="absolute left-full ml-2 px-2.5 py-1 bg-neutral-900 dark:bg-neutral-800 text-white text-xs rounded-md shadow-md opacity-0 pointer-events-none group-hover/item:opacity-100 transition-opacity z-50 whitespace-nowrap">
                    {item.label}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom controls: Theme toggle & User profile */}
        <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 space-y-2 shrink-0">
          {onOpenShortcutsHelp && (
            <button
              onClick={onOpenShortcutsHelp}
              title={sidebarMode !== 'full' ? 'Atalhos de Teclado (?)' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer ${
                sidebarMode !== 'full' ? 'justify-center' : ''
              }`}
            >
              <Keyboard className="h-4 w-4 shrink-0 text-neutral-500 dark:text-neutral-400" />
              {sidebarMode === 'full' && (
                <div className="flex-1 flex items-center justify-between">
                  <span>Atalhos</span>
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-400">
                    ?
                  </kbd>
                </div>
              )}
            </button>
          )}

          <button
            onClick={onToggleTheme}
            title={sidebarMode !== 'full' ? (theme === 'dark' ? 'Tema Claro' : 'Tema Escuro') : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer ${
              sidebarMode !== 'full' ? 'justify-center' : ''
            }`}
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 text-amber-400 shrink-0" />
            ) : (
              <Moon className="h-4 w-4 shrink-0" />
            )}
            {sidebarMode === 'full' && (
              <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>
            )}
          </button>

          {/* User profile card */}
          {user ? (
            <button
              onClick={onOpenAuth}
              title={sidebarMode !== 'full' ? user.name : undefined}
              className={`w-full flex items-center gap-3 p-2 rounded-xl bg-neutral-50 dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left cursor-pointer ${
                sidebarMode !== 'full' ? 'justify-center' : ''
              }`}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-bold text-xs shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              {sidebarMode === 'full' && (
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">{user.name}</p>
                  <p className="text-2xs text-neutral-500 truncate">{tenant?.name || 'Workspace'}</p>
                </div>
              )}
            </button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenAuth}
              className={`w-full text-xs cursor-pointer ${sidebarMode !== 'full' ? 'px-2' : ''}`}
            >
              {sidebarMode === 'full' ? 'Entrar / Conta' : <UserIcon className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </aside>
    </>
  );
};
