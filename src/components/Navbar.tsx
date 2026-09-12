import React, { useState } from 'react';
import {
  Clock,
  BarChart3,
  History,
  Briefcase,
  Settings,
  User as UserIcon,
  Building2,
  Moon,
  Sun,
  Menu,
  X,
  ChevronRight,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { User, Tenant, TimeSession } from '../types';
import { formatCurrency } from '../utils/format';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

interface NavbarProps {
  activeTab: 'timer' | 'reports' | 'history' | 'clients' | 'settings' | 'assistant';
  setActiveTab: (tab: 'timer' | 'reports' | 'history' | 'clients' | 'settings' | 'assistant') => void;
  user: User | null;
  tenant: Tenant | null;
  activeSession: TimeSession | null;
  onOpenAuth: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export function Navbar({
  activeTab,
  setActiveTab,
  user,
  tenant,
  activeSession,
  onOpenAuth,
  theme,
  onToggleTheme,
}: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleTabSelect = (tab: 'timer' | 'reports' | 'history' | 'clients' | 'settings' | 'assistant') => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xs transition-colors">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand & Workspace Indicator */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 shadow-xs shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                  Time Tracking
                </span>
                <span className="hidden sm:inline-block text-xs text-neutral-400 dark:text-neutral-500 font-medium">
                  &amp; Faturamento
                </span>
              </div>
              {tenant && (
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                  <Building2 className="h-3 w-3 text-neutral-400 dark:text-neutral-500" />
                  <span className="font-medium text-neutral-700 dark:text-neutral-300 truncate max-w-[140px]">
                    {tenant.name}
                  </span>
                  <span className="text-neutral-300 dark:text-neutral-700">•</span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                    {formatCurrency(user?.default_hourly_rate || 150)}/h
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1.5">
            <button
              onClick={() => handleTabSelect('timer')}
              className={`relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'timer'
                  ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-2xs font-semibold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
            >
              <Clock className="h-4 w-4" />
              <span>Cronômetro</span>
              {activeSession && (
                <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </button>

            <button
              onClick={() => handleTabSelect('reports')}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'reports'
                  ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-2xs font-semibold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              <span>Relatórios</span>
            </button>

            <button
              onClick={() => handleTabSelect('history')}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-2xs font-semibold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
            >
              <History className="h-4 w-4" />
              <span>Histórico</span>
            </button>

            <button
              onClick={() => handleTabSelect('clients')}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'clients'
                  ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-2xs font-semibold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
            >
              <Briefcase className="h-4 w-4" />
              <span>Clientes</span>
            </button>

            <button
              onClick={() => handleTabSelect('settings')}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-2xs font-semibold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
            >
              <Settings className="h-4 w-4" />
              <span>Configurações</span>
            </button>

            <button
              onClick={() => handleTabSelect('assistant')}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all cursor-pointer ${
                activeTab === 'assistant'
                  ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                  : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
              }`}
            >
              <Sparkles className="h-4 w-4" />
              <span>Assistente IA</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-500/20 dark:bg-indigo-400/20 font-bold uppercase tracking-wider">
                60s
              </span>
            </button>
          </nav>

          {/* Right Action Controls: Theme Toggle + User Switcher + Mobile Toggle */}
          <div className="flex items-center gap-2">
            {/* Dark Theme Toggle Button */}
            <button
              onClick={onToggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-neutral-400"
              title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
              aria-label="Alternar tema escuro/claro"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400 transition-transform rotate-0" />
              ) : (
                <Moon className="h-4 w-4 text-neutral-600 dark:text-neutral-300 transition-transform rotate-0" />
              )}
            </button>

            {/* Desktop User Account Button */}
            <div className="hidden sm:flex items-center">
              {user ? (
                <button
                  onClick={onOpenAuth}
                  className="flex items-center gap-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2.5 py-1.5 text-xs font-semibold text-neutral-800 dark:text-neutral-100 shadow-2xs hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer transition-colors"
                  title="Gerenciar conta / Trocar de tenant"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-semibold text-xs">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-semibold truncate max-w-[100px] text-neutral-800 dark:text-neutral-100">
                    {user.name.split(' ')[0]}
                  </span>
                </button>
              ) : (
                <button
                  onClick={onOpenAuth}
                  className="flex items-center gap-1.5 rounded-lg bg-neutral-900 dark:bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-white dark:text-neutral-900 shadow-xs hover:bg-neutral-800 dark:hover:bg-neutral-200 cursor-pointer"
                >
                  <UserIcon className="h-3.5 w-3.5" />
                  <span>Entrar</span>
                </button>
              )}
            </div>

            {/* Mobile Hamburger Menu Button (44px min touch target) */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex md:hidden h-11 w-11 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              aria-label="Abrir menu de navegação"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 pt-3 pb-5 shadow-lg space-y-4 animate-in slide-in-from-top-2 duration-150">
            {/* Tenant and User Header Card on Mobile */}
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850 p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-bold text-sm">
                  {user ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {user ? user.name : 'Convidado'}
                  </h4>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {tenant ? tenant.name : 'Workspace'} •{' '}
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      {formatCurrency(user?.default_hourly_rate || 150)}/h
                    </span>
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAuth();
                }}
                className="text-xs h-8 px-2.5 cursor-pointer"
              >
                Conta
              </Button>
            </div>

            {/* Mobile Navigation Links (touch targets >= 44px) */}
            <div className="space-y-1">
              <button
                onClick={() => handleTabSelect('timer')}
                className={`w-full min-h-[44px] flex items-center justify-between rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                  activeTab === 'timer'
                    ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-semibold'
                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-850'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-neutral-500 dark:text-neutral-400" />
                  <span>Cronômetro</span>
                </div>
                {activeSession ? (
                  <Badge variant="amber" className="text-2xs uppercase animate-pulse">
                    Em execução
                  </Badge>
                ) : (
                  <ChevronRight className="h-4 w-4 text-neutral-400" />
                )}
              </button>

              <button
                onClick={() => handleTabSelect('reports')}
                className={`w-full min-h-[44px] flex items-center justify-between rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                  activeTab === 'reports'
                    ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-semibold'
                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-850'
                }`}
              >
                <div className="flex items-center gap-3">
                  <BarChart3 className="h-5 w-5 text-neutral-500 dark:text-neutral-400" />
                  <span>Relatórios &amp; Faturamento</span>
                </div>
                <ChevronRight className="h-4 w-4 text-neutral-400" />
              </button>

              <button
                onClick={() => handleTabSelect('history')}
                className={`w-full min-h-[44px] flex items-center justify-between rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                  activeTab === 'history'
                    ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-semibold'
                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-850'
                }`}
              >
                <div className="flex items-center gap-3">
                  <History className="h-5 w-5 text-neutral-500 dark:text-neutral-400" />
                  <span>Histórico de Sessões</span>
                </div>
                <ChevronRight className="h-4 w-4 text-neutral-400" />
              </button>

              <button
                onClick={() => handleTabSelect('clients')}
                className={`w-full min-h-[44px] flex items-center justify-between rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                  activeTab === 'clients'
                    ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-semibold'
                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-850'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Briefcase className="h-5 w-5 text-neutral-500 dark:text-neutral-400" />
                  <span>Área de Clientes</span>
                </div>
                <ChevronRight className="h-4 w-4 text-neutral-400" />
              </button>

              <button
                onClick={() => handleTabSelect('settings')}
                className={`w-full min-h-[44px] flex items-center justify-between rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                  activeTab === 'settings'
                    ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-semibold'
                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-850'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Settings className="h-5 w-5 text-neutral-500 dark:text-neutral-400" />
                  <span>Configurações &amp; Perfil</span>
                </div>
                <ChevronRight className="h-4 w-4 text-neutral-400" />
              </button>

              <button
                onClick={() => handleTabSelect('assistant')}
                className={`w-full min-h-[44px] flex items-center justify-between rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                  activeTab === 'assistant'
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5" />
                  <span>Assistente IA (Cronos AI)</span>
                </div>
                <Badge variant="indigo" className="text-2xs">
                  60 steps
                </Badge>
              </button>
            </div>

            {/* Quick theme switcher row in mobile menu */}
            <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between px-1">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                Tema: {theme === 'dark' ? 'Escuro' : 'Claro'}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={onToggleTheme}
                className="text-xs gap-1.5 h-8 cursor-pointer"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="h-3.5 w-3.5 text-amber-400" />
                    <span>Tema Claro</span>
                  </>
                ) : (
                  <>
                    <Moon className="h-3.5 w-3.5 text-neutral-600" />
                    <span>Tema Escuro</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* Persistent Mobile Bottom Navigation Bar (thumb-friendly on smartphones) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md px-2 py-1 shadow-lg flex items-center justify-around safe-area-pb">
        <button
          onClick={() => handleTabSelect('timer')}
          className={`relative flex flex-col items-center justify-center py-1.5 px-3 min-w-[64px] min-h-[44px] rounded-lg transition-colors cursor-pointer ${
            activeTab === 'timer'
              ? 'text-neutral-900 dark:text-neutral-100 font-semibold'
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700'
          }`}
        >
          <div className="relative">
            <Clock className="h-5 w-5" />
            {activeSession && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </div>
          <span className="text-[10px] mt-1">Timer</span>
        </button>

        <button
          onClick={() => handleTabSelect('reports')}
          className={`flex flex-col items-center justify-center py-1.5 px-3 min-w-[64px] min-h-[44px] rounded-lg transition-colors cursor-pointer ${
            activeTab === 'reports'
              ? 'text-neutral-900 dark:text-neutral-100 font-semibold'
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700'
          }`}
        >
          <BarChart3 className="h-5 w-5" />
          <span className="text-[10px] mt-1">Relatórios</span>
        </button>

        <button
          onClick={() => handleTabSelect('history')}
          className={`flex flex-col items-center justify-center py-1.5 px-3 min-w-[64px] min-h-[44px] rounded-lg transition-colors cursor-pointer ${
            activeTab === 'history'
              ? 'text-neutral-900 dark:text-neutral-100 font-semibold'
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700'
          }`}
        >
          <History className="h-5 w-5" />
          <span className="text-[10px] mt-1">Histórico</span>
        </button>

        <button
          onClick={() => handleTabSelect('settings')}
          className={`flex flex-col items-center justify-center py-1.5 px-2 min-w-[56px] min-h-[44px] rounded-lg transition-colors cursor-pointer ${
            activeTab === 'settings'
              ? 'text-neutral-900 dark:text-neutral-100 font-semibold'
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700'
          }`}
        >
          <Settings className="h-5 w-5" />
          <span className="text-[10px] mt-1">Perfil</span>
        </button>

        <button
          onClick={() => handleTabSelect('assistant')}
          className={`flex flex-col items-center justify-center py-1.5 px-2 min-w-[56px] min-h-[44px] rounded-lg transition-colors cursor-pointer ${
            activeTab === 'assistant'
              ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
              : 'text-neutral-500 dark:text-neutral-400 hover:text-indigo-600'
          }`}
        >
          <Sparkles className="h-5 w-5" />
          <span className="text-[10px] mt-1">IA</span>
        </button>
      </nav>
    </>
  );
}
