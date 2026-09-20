import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Building2,
  ChevronDown,
  Plus,
  Check,
  Briefcase,
  Shield,
  Loader2,
  X,
  Sparkles,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useToast } from './ui/toast';
import { apiFetch } from '../utils/api';
import { WorkspaceItem } from '../types';

interface WorkspaceSelectorProps {
  onWorkspaceChange?: () => void;
}

export function WorkspaceSelector({ onWorkspaceChange }: WorkspaceSelectorProps) {
  const { addToast } = useToast();
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [plan, setPlan] = useState<{ id: string; name: string; max_workspaces: number } | null>(null);
  const [usage, setUsage] = useState<{ workspaces_count: number; max_workspaces: number; can_create: boolean; locked_count?: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedLockedWorkspace, setSelectedLockedWorkspace] = useState<WorkspaceItem | null>(null);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceDesc, setNewWorkspaceDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchWorkspaces = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/workspaces');
      if (res.ok) {
        const data = await res.json();
        const wsList: WorkspaceItem[] = data.workspaces || [];
        setWorkspaces(wsList);
        if (data.plan) setPlan(data.plan);
        if (data.usage) setUsage(data.usage);

        // Check if currently saved workspace is locked (e.g. after downgrade to Free)
        const savedId = localStorage.getItem('cronos_active_workspace_id');
        const activeWs = wsList.find((w) => w.id === savedId) || wsList.find((w) => w.is_active) || wsList[0];
        const firstUnlocked = wsList.find((w) => !w.is_locked) || wsList[0];

        if (activeWs && activeWs.is_locked && firstUnlocked) {
          localStorage.setItem('cronos_active_workspace_id', firstUnlocked.id);
          addToast({
            title: 'Workspace Bloqueado no Plano Free',
            description: `O workspace "${activeWs.name}" foi bloqueado após a alteração de plano. Alternamos automaticamente para o workspace liberado "${firstUnlocked.name}".`,
            variant: 'destructive',
          });
          window.dispatchEvent(new CustomEvent('workspace-changed', { detail: { workspaceId: firstUnlocked.id } }));
          if (onWorkspaceChange) {
            onWorkspaceChange();
          }
        } else if (!savedId && firstUnlocked) {
          localStorage.setItem('cronos_active_workspace_id', firstUnlocked.id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch workspaces:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();

    const handleExternalChange = () => {
      fetchWorkspaces();
    };

    const handleLockedDetected = (e: any) => {
      fetchWorkspaces();
      if (e.detail?.error) {
        addToast({
          title: 'Workspace Bloqueado',
          description: e.detail.error,
          variant: 'destructive',
        });
      }
    };

    window.addEventListener('workspace-changed', handleExternalChange);
    window.addEventListener('workspace-locked-detected', handleLockedDetected);
    return () => {
      window.removeEventListener('workspace-changed', handleExternalChange);
      window.removeEventListener('workspace-locked-detected', handleLockedDetected);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeWorkspace = workspaces.find((w) => w.is_active && !w.is_locked) || workspaces.find((w) => !w.is_locked) || workspaces[0];

  const handleSelectWorkspace = async (ws: WorkspaceItem) => {
    if (ws.is_locked) {
      setIsOpen(false);
      setSelectedLockedWorkspace(ws);
      return;
    }

    localStorage.setItem('cronos_active_workspace_id', ws.id);
    setIsOpen(false);
    addToast({
      title: 'Workspace alterado',
      description: `Alternando para o workspace "${ws.name}"...`,
      variant: 'success',
    });
    await fetchWorkspaces();
    window.dispatchEvent(new CustomEvent('workspace-changed', { detail: { workspaceId: ws.id } }));
    if (onWorkspaceChange) {
      onWorkspaceChange();
    } else {
      window.location.reload();
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;

    try {
      setCreating(true);
      const res = await apiFetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newWorkspaceName.trim(),
          description: newWorkspaceDesc.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao criar workspace');
      }

      addToast({
        title: 'Workspace criado!',
        description: `O workspace "${newWorkspaceName}" foi criado com sucesso.`,
        variant: 'success',
      });

      localStorage.setItem('cronos_active_workspace_id', data.workspace.id);
      setShowCreateModal(false);
      setNewWorkspaceName('');
      setNewWorkspaceDesc('');
      await fetchWorkspaces();
      window.dispatchEvent(new CustomEvent('workspace-changed', { detail: { workspaceId: data.workspace.id } }));
      if (onWorkspaceChange) {
        onWorkspaceChange();
      } else {
        window.location.reload();
      }
    } catch (err: any) {
      addToast({
        title: 'Erro ao criar workspace',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors text-xs font-medium cursor-pointer max-w-[200px] sm:max-w-[240px]"
        title="Selecionar Workspace"
      >
        <Building2 className="h-3.5 w-3.5 text-neutral-500 dark:text-neutral-400 shrink-0" />
        <span className="truncate">{activeWorkspace ? activeWorkspace.name : 'Selecionar Workspace'}</span>
        <ChevronDown className="h-3.5 w-3.5 text-neutral-400 shrink-0 ml-auto" />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-80 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-lg p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2 py-1.5 flex items-center justify-between text-xs font-semibold text-neutral-400 uppercase tracking-wider">
            <span>Workspaces ({workspaces.length})</span>
            {usage?.locked_count && usage.locked_count > 0 ? (
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium normal-case flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" />
                {usage.locked_count} bloqueado{usage.locked_count > 1 ? 's' : ''}
              </span>
            ) : null}
          </div>

          <div className="space-y-1 my-1 max-h-64 overflow-y-auto">
            {workspaces.map((ws) => {
              const isLocked = !!ws.is_locked;
              return (
                <button
                  key={ws.id}
                  onClick={() => handleSelectWorkspace(ws)}
                  className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                    ws.is_active && !isLocked
                      ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-medium'
                      : isLocked
                      ? 'opacity-75 bg-amber-50/50 dark:bg-amber-950/20 text-neutral-500 dark:text-neutral-400 hover:bg-amber-100/60 dark:hover:bg-amber-950/40'
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 hover:text-neutral-900 dark:hover:text-neutral-100'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 ${
                        ws.is_active && !isLocked
                          ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900'
                          : isLocked
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60'
                          : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300'
                      }`}
                    >
                      {isLocked ? <Lock className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium truncate">{ws.name}</span>
                        {isLocked && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60 shrink-0">
                            BLOQUEADO
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-neutral-400 capitalize">
                        {isLocked ? 'Bloqueado no plano Free' : `${ws.role} • ${ws.members_count} ${ws.members_count === 1 ? 'membro' : 'membros'}`}
                      </div>
                    </div>
                  </div>
                  {ws.is_active && !isLocked && (
                    <Check className="h-4 w-4 text-neutral-900 dark:text-neutral-100 shrink-0 ml-2" />
                  )}
                  {isLocked && (
                    <Lock className="h-3.5 w-3.5 text-amber-500 shrink-0 ml-2" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
            {plan?.id === 'free' ? (
              <div
                onClick={() => {
                  setIsOpen(false);
                  addToast({
                    title: 'Recurso Pro',
                    description: 'O plano Free permite apenas 1 workspace. Faça upgrade para o plano Pro para criar múltiplos workspaces.',
                    variant: 'destructive',
                  });
                }}
                className="w-full flex items-center justify-between px-2 py-2 rounded-lg text-xs font-medium text-neutral-400 dark:text-neutral-500 bg-neutral-50 dark:bg-neutral-800/40 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  <span>Criar Novo Workspace</span>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  PRO
                </span>
              </div>
            ) : (
              <button
                onClick={() => {
                  setIsOpen(false);
                  setShowCreateModal(true);
                }}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Criar Novo Workspace</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Locked Workspace Explanation Modal */}
      {selectedLockedWorkspace && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-200 dark:border-amber-900/60">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                    Workspace Bloqueado
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Limite de workspaces do plano Free
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLockedWorkspace(null)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
                <Building2 className="h-4 w-4 shrink-0" />
                <span>{selectedLockedWorkspace.name}</span>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300/90 leading-relaxed">
                Este workspace foi criado anteriormente em um plano superior. Ao migrar para o <strong>Plano Free</strong>, apenas o primeiro workspace criado fica liberado para acesso e qualquer tipo de edição.
              </p>
            </div>

            <div className="space-y-2 text-xs text-neutral-600 dark:text-neutral-400">
              <div className="flex items-start gap-2">
                <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Seus dados, clientes e sessões continuam armazenados com total segurança.</span>
              </div>
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                <span>Faça upgrade para o <strong>Plano Pro</strong> para desbloquear o acesso e edição a este workspace.</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedLockedWorkspace(null)}
                className="text-xs cursor-pointer"
              >
                Entendi
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setSelectedLockedWorkspace(null);
                  window.dispatchEvent(new CustomEvent('navigate-to', { detail: { view: 'settings', tab: 'billing' } }));
                }}
                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Ver Planos & Upgrade</span>
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Create Workspace Modal */}
      {showCreateModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 flex items-center justify-center">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">Criar Novo Workspace</h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Organize seus projetos e equipe em um novo espaço</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateWorkspace} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Nome do Workspace <span className="text-red-500">*</span>
                </label>
                <Input
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  placeholder="Ex: Agência Criativa, Projeto Alpha..."
                  required
                  autoFocus
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Descrição (Opcional)
                </label>
                <Input
                  value={newWorkspaceDesc}
                  onChange={(e) => setNewWorkspaceDesc(e.target.value)}
                  placeholder="Breve descrição do espaço de trabalho..."
                  className="text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                  className="text-xs cursor-pointer"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={creating || !newWorkspaceName.trim()}
                  className="text-xs bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 cursor-pointer gap-1.5"
                >
                  {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Criar Workspace</span>
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
