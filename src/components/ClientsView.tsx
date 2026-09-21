import React, { useState } from 'react';
import {
  Briefcase,
  Plus,
  Mail,
  Building2,
  DollarSign,
  Edit2,
  Trash2,
  Users,
  KeyRound,
  Check,
  Target,
  AlertTriangle,
} from 'lucide-react';
import { Client, Tenant } from '../types';
import { formatCurrency } from '../utils/format';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { useToast } from './ui/toast';
import { Dialog } from './ui/dialog';
import { EmptyState } from './ui/empty-state';
import { apiFetch } from '../utils/api';

interface ClientsViewProps {
  clients: Client[];
  tenant?: Tenant | null;
  onRefreshClients: () => Promise<void>;
  defaultHourlyRate: number;
  onNavigateToNewClient: () => void;
  onNavigateToEditClient: (clientId: string) => void;
  onNavigateToClientContacts: (clientId: string) => void;
}

export function ClientsView({
  clients,
  tenant,
  onRefreshClients,
  defaultHourlyRate,
  onNavigateToNewClient,
  onNavigateToEditClient,
  onNavigateToClientContacts,
}: ClientsViewProps) {
  const { addToast } = useToast();
  const [deleteClientId, setDeleteClientId] = useState<string | null>(null);

  const confirmDelete = async () => {
    if (!deleteClientId) return;
    try {
      const res = await apiFetch(`/api/clients/${deleteClientId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao excluir cliente');
      addToast({ title: 'Cliente excluído com sucesso.', variant: 'default' });
      setDeleteClientId(null);
      await onRefreshClients();
    } catch (err: any) {
      addToast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <span>Área de Clientes</span>
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Gerencie seus clientes e projetos para vincular às sessões de tempo e relatórios.
          </p>
        </div>
        <Button
          onClick={onNavigateToNewClient}
          className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-sm text-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Cliente</span>
        </Button>
      </div>

      {clients.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="Nenhum cliente cadastrado"
          description="Cadastre seu primeiro cliente para organizar suas horas trabalhadas, projetos e faturamento."
          actionLabel="Cadastrar Primeiro Cliente"
          onAction={onNavigateToNewClient}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {clients.map((client) => {
            const clientRate = client.hourly_rate ?? defaultHourlyRate;
            const contacts = client.Contacts || client.contacts || [];
            return (
              <Card key={client.id} className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs hover:shadow-sm transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                        {client.name}
                      </CardTitle>
                      {client.company && (
                        <CardDescription className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                          <Building2 className="w-3.5 h-3.5" />
                          <span>{client.company}</span>
                        </CardDescription>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onNavigateToEditClient(client.id)}
                        className="h-8 w-8 p-0 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 cursor-pointer"
                        title="Editar cliente"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteClientId(client.id)}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700 dark:hover:text-red-400 cursor-pointer"
                        title="Excluir cliente"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0 text-xs">
                  <div className="flex flex-wrap items-center gap-4 text-neutral-600 dark:text-neutral-300">
                    {client.email && (
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-neutral-400" />
                        <span>{client.email}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>{formatCurrency(clientRate)} / hora</span>
                      {client.hourly_rate == null && (
                        <span className="text-2xs text-neutral-400 font-normal">(padrão)</span>
                      )}
                    </div>
                    {client.daily_target_minutes && client.daily_target_minutes > 0 ? (
                      <div className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
                        <Target className="w-3.5 h-3.5" />
                        <span>Meta diária: {client.daily_target_minutes} min ({(client.daily_target_minutes / 60).toFixed(1)}h)</span>
                      </div>
                    ) : null}
                  </div>

                  {client.notes && (
                    <p className="text-neutral-500 dark:text-neutral-400 italic bg-neutral-50 dark:bg-neutral-850 p-2.5 rounded-md border border-neutral-100 dark:border-neutral-800">
                      "{client.notes}"
                    </p>
                  )}

                  {/* Client Contacts & Approvers section */}
                  <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
                        <Users className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="font-medium text-2xs uppercase tracking-wider">
                          Contatos ({contacts.length})
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onNavigateToClientContacts(client.id)}
                        className="h-7 px-2.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
                      >
                        <Users className="w-3.5 h-3.5 mr-1 text-indigo-500" />
                        <span>Gerenciar Contatos</span>
                      </Button>
                    </div>

                    {contacts.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {contacts.slice(0, 2).map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center justify-between p-1.5 rounded-md bg-neutral-50 dark:bg-neutral-850 border border-neutral-150 dark:border-neutral-800"
                          >
                            <div className="flex items-center gap-2 truncate pr-2">
                              <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-3xs font-bold flex items-center justify-center shrink-0">
                                {c.name.charAt(0).toUpperCase()}
                              </span>
                              <div className="truncate">
                                <span className="font-semibold text-neutral-800 dark:text-neutral-200 truncate block">
                                  {c.name}
                                </span>
                                <span className="text-3xs text-neutral-500 dark:text-neutral-400 truncate block">
                                  {c.email}
                                </span>
                              </div>
                            </div>
                            <div>
                              {c.must_change_password ? (
                                <span
                                  title="Primeiro acesso pendente: ao entrar para aprovação, definirá uma nova senha"
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-3xs font-medium bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60"
                                >
                                  <KeyRound className="w-2.5 h-2.5" />
                                  <span>1º Acesso</span>
                                </span>
                              ) : (
                                <span
                                  title="Senha definitiva cadastrada no primeiro acesso"
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-3xs font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60"
                                >
                                  <Check className="w-2.5 h-2.5" />
                                  <span>Ativo</span>
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                        {contacts.length > 2 && (
                          <p className="text-3xs text-neutral-400 text-right">
                            +{contacts.length - 2} outro(s) contato(s)
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Dialog
        open={Boolean(deleteClientId)}
        onOpenChange={(open) => !open && setDeleteClientId(null)}
        title="Excluir Cliente"
        description="Tem certeza que deseja excluir este cliente? As sessões vinculadas não serão apagadas, mas perderão o vínculo."
      >
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-300 text-xs">
            <AlertTriangle className="w-5 h-5 shrink-0 text-red-600 dark:text-red-400" />
            <span>Esta ação é irreversível.</span>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setDeleteClientId(null)}
              className="cursor-pointer text-xs"
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white cursor-pointer text-xs"
            >
              Sim, Excluir
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
