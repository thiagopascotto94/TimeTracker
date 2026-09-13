import React, { useState } from 'react';
import { Briefcase, Plus, Mail, Building2, DollarSign, Edit2, Trash2, X, Save, AlertTriangle } from 'lucide-react';
import { Client } from '../types';
import { formatCurrency } from '../utils/format';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useToast } from './ui/toast';
import { Dialog } from './ui/dialog';
import { apiFetch } from '../utils/api';

interface ClientsViewProps {
  clients: Client[];
  onRefreshClients: () => Promise<void>;
  defaultHourlyRate: number;
}

export function ClientsView({ clients, onRefreshClients, defaultHourlyRate }: ClientsViewProps) {
  const { addToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteClientId, setDeleteClientId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleOpenAdd = () => {
    setEditingClient(null);
    setName('');
    setCompany('');
    setEmail('');
    setHourlyRate('');
    setNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (client: Client) => {
    setEditingClient(client);
    setName(client.name);
    setCompany(client.company || '');
    setEmail(client.email || '');
    setHourlyRate(client.hourly_rate ? client.hourly_rate.toString() : '');
    setNotes(client.notes || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast({ title: 'Nome obrigatório', description: 'Informe o nome do cliente.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        company: company.trim() || null,
        email: email.trim() || null,
        hourly_rate: hourlyRate ? parseFloat(hourlyRate) : null,
        notes: notes.trim() || null,
      };

      if (editingClient) {
        const res = await apiFetch(`/api/clients/${editingClient.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao atualizar cliente');
        addToast({ title: 'Cliente atualizado com sucesso!', variant: 'default' });
      } else {
        const res = await apiFetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao cadastrar cliente');
        addToast({ title: 'Cliente cadastrado com sucesso!', variant: 'default' });
      }

      setIsModalOpen(false);
      await onRefreshClients();
    } catch (err: any) {
      addToast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

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
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <span>Área de Clientes</span>
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Cadastre e gerencie seus clientes para vincular às sessões de tempo e relatórios.
          </p>
        </div>
        <Button
          onClick={handleOpenAdd}
          className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Cliente</span>
        </Button>
      </div>

      {clients.length === 0 ? (
        <Card className="border border-dashed border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-12 text-center">
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Briefcase className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">Nenhum cliente cadastrado</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm">
              Cadastre seu primeiro cliente para organizar suas horas trabalhadas e faturamento por projeto.
            </p>
            <Button onClick={handleOpenAdd} variant="outline" size="sm" className="mt-2 cursor-pointer">
              Cadastrar Primeiro Cliente
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {clients.map((client) => {
            const clientRate = client.hourly_rate ?? defaultHourlyRate;
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
                        onClick={() => handleOpenEdit(client)}
                        className="h-8 w-8 p-0 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteClientId(client.id)}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700 dark:hover:text-red-400 cursor-pointer"
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
                  </div>

                  {client.notes && (
                    <p className="text-neutral-500 dark:text-neutral-400 italic bg-neutral-50 dark:bg-neutral-850 p-2.5 rounded-md border border-neutral-100 dark:border-neutral-800">
                      "{client.notes}"
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Add/Edit Client */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="font-bold text-neutral-900 dark:text-neutral-100">
                {editingClient ? 'Editar Cliente' : 'Novo Cliente'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Nome do Cliente / Projeto *
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: João Silva ou Projeto Alpha"
                  required
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Empresa / Organização
                </label>
                <Input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Ex: Acme Corporation"
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  E-mail de Contato
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contato@empresa.com"
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Taxa por Hora Específica (R$)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder={`Padrão do workspace: R$ ${defaultHourlyRate}`}
                  className="text-sm font-mono"
                />
                <p className="text-2xs text-neutral-400">
                  Deixe em branco para usar a taxa padrão configurada em Ajustes.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Observações / Escopo
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Detalhes ou acordos do contrato..."
                  rows={3}
                  className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="cursor-pointer"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{submitting ? 'Salvando...' : 'Salvar'}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Dialog
        open={Boolean(deleteClientId)}
        onOpenChange={(open) => !open && setDeleteClientId(null)}
        title="Excluir Cliente"
        description="Tem certeza que deseja excluir este cliente? As sessões vinculadas ficarão sem cliente associado."
      >
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-300 text-xs">
            <AlertTriangle className="w-5 h-5 shrink-0 text-red-600 dark:text-red-400" />
            <span>Esta ação é irreversível e removerá o vínculo do cliente nas sessões existentes.</span>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setDeleteClientId(null)}
              className="cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white cursor-pointer"
            >
              Sim, Excluir
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
