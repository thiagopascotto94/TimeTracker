import React, { useState } from 'react';
import { Dialog } from './ui/dialog';
import { Button } from './ui/button';
import { GitRepositoryPermissionManager } from './GitRepositoryPermissionManager';
import { GitRepositoryItem } from '../types';
import { ShieldCheck, Save, Loader2, Check } from 'lucide-react';
import { apiFetch } from '../utils/api';
import { useToast } from './ui/toast';

interface GitRepositoryPermissionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: 'github' | 'gitlab';
  token?: string;
  gitlabUrl?: string;
  clientId?: string;
  clientName?: string;
  allowedRepositories: GitRepositoryItem[];
  onChangeAllowedRepositories: (repos: GitRepositoryItem[]) => void;
  onSelectDefaultRepo?: (repoFullName: string, defaultBranch?: string) => void;
  defaultRepoFullName?: string;
  onSaveSuccess?: () => void;
}

export function GitRepositoryPermissionModal({
  open,
  onOpenChange,
  provider,
  token,
  gitlabUrl,
  clientId,
  clientName,
  allowedRepositories,
  onChangeAllowedRepositories,
  onSelectDefaultRepo,
  defaultRepoFullName,
  onSaveSuccess,
}: GitRepositoryPermissionModalProps) {
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiFetch('/api/git/allowed-repositories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repositories: allowedRepositories,
          client_id: clientId || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Falha ao persistir lista de repositórios');
      }

      addToast({
        title: 'Permissões salvas',
        description: clientId && clientName
          ? `${allowedRepositories.length} repositório(s) salvos para o cliente "${clientName}".`
          : `${allowedRepositories.length} repositório(s) autorizados foram salvos com sucesso.`,
        variant: 'success',
      });

      if (onSaveSuccess) {
        onSaveSuccess();
      }
      onOpenChange(false);
    } catch (err: any) {
      console.error('Error saving allowed repositories:', err);
      addToast({
        title: 'Erro ao salvar',
        description: err.message || 'Não foi possível persistir as permissões.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={clientName ? `Repositórios Git do Cliente: ${clientName}` : 'Gerenciar Permissões de Repositórios Git'}
      description={
        clientName
          ? `Vincule repositórios ao cliente "${clientName}". Na sessão de foco deste cliente, apenas esses repositórios serão exibidos.`
          : 'Descubra e selecione quais repositórios da sua conta terão permissão de acesso no Cronos.'
      }
      className="max-w-3xl max-h-[92vh] flex flex-col p-6 overflow-hidden"
    >
      <div className="flex-1 overflow-y-auto pr-1 py-1">
        <GitRepositoryPermissionManager
          provider={provider}
          token={token}
          gitlabUrl={gitlabUrl}
          clientId={clientId}
          allowedRepositories={allowedRepositories}
          onChangeAllowedRepositories={onChangeAllowedRepositories}
          onSelectDefaultRepo={onSelectDefaultRepo}
          defaultRepoFullName={defaultRepoFullName}
          className="border-0 p-0 bg-transparent"
        />
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-neutral-200 dark:border-neutral-800 mt-3">
        <span className="text-2xs text-neutral-500">
          {clientName
            ? `Total de ${allowedRepositories.length} repositório(s) vinculados a ${clientName}.`
            : `Total de ${allowedRepositories.length} repositório(s) selecionados para o workspace.`}
        </span>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Salvar Permissões ({allowedRepositories.length})</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
