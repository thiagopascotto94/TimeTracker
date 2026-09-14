import React, { useState } from 'react';
import {
  Briefcase,
  Plus,
  Mail,
  Building2,
  DollarSign,
  Edit2,
  Trash2,
  X,
  Save,
  AlertTriangle,
  Users,
  KeyRound,
  Copy,
  Check,
  Phone,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  UserCheck,
} from 'lucide-react';
import { Client, ClientContact } from '../types';
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

  // Client form states
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Contacts management states
  const [contactClient, setContactClient] = useState<Client | null>(null);
  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactRole, setNewContactRole] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [submittingContact, setSubmittingContact] = useState(false);
  const [resettingContactId, setResettingContactId] = useState<string | null>(null);
  const [deletingContactId, setDeletingContactId] = useState<string | null>(null);

  // Generated credentials popup state
  const [credentialsModal, setCredentialsModal] = useState<{
    open: boolean;
    name: string;
    email: string;
    tempPassword: string;
    isReset?: boolean;
  } | null>(null);
  const [copiedCredential, setCopiedCredential] = useState(false);

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

  // Find active contact client reactively from clients list
  const currentContactClient = contactClient
    ? clients.find((c) => c.id === contactClient.id) || contactClient
    : null;

  const handleOpenContacts = (client: Client) => {
    setContactClient(client);
    setNewContactName('');
    setNewContactEmail('');
    setNewContactRole('');
    setNewContactPhone('');
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentContactClient) return;

    if (!newContactName.trim()) {
      addToast({ title: 'Nome obrigatório', description: 'Informe o nome do contato.', variant: 'destructive' });
      return;
    }
    if (!newContactEmail.trim()) {
      addToast({ title: 'E-mail obrigatório', description: 'Informe o e-mail do contato (usuário de login).', variant: 'destructive' });
      return;
    }

    setSubmittingContact(true);
    try {
      const res = await apiFetch(`/api/clients/${currentContactClient.id}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newContactName.trim(),
          email: newContactEmail.trim(),
          role: newContactRole.trim() || null,
          phone: newContactPhone.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao cadastrar contato');

      addToast({ title: 'Contato cadastrado!', description: 'Senha temporária aleatória gerada com sucesso.', variant: 'default' });
      setNewContactName('');
      setNewContactEmail('');
      setNewContactRole('');
      setNewContactPhone('');

      await onRefreshClients();

      // Show generated credentials modal
      setCredentialsModal({
        open: true,
        name: data.contact.name,
        email: data.contact.email,
        tempPassword: data.tempPassword,
        isReset: false,
      });
    } catch (err: any) {
      addToast({ title: 'Erro ao cadastrar contato', description: err.message, variant: 'destructive' });
    } finally {
      setSubmittingContact(false);
    }
  };

  const handleResetContactPassword = async (contact: ClientContact) => {
    if (!currentContactClient) return;
    setResettingContactId(contact.id);
    try {
      const res = await apiFetch(`/api/clients/${currentContactClient.id}/contacts/${contact.id}/reset-password`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao redefinir senha');

      addToast({ title: 'Nova senha temporária gerada!', variant: 'default' });
      await onRefreshClients();

      setCredentialsModal({
        open: true,
        name: contact.name,
        email: contact.email,
        tempPassword: data.tempPassword,
        isReset: true,
      });
    } catch (err: any) {
      addToast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setResettingContactId(null);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!currentContactClient) return;
    setDeletingContactId(contactId);
    try {
      const res = await apiFetch(`/api/clients/${currentContactClient.id}/contacts/${contactId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao excluir contato');

      addToast({ title: 'Contato excluído com sucesso.', variant: 'default' });
      await onRefreshClients();
    } catch (err: any) {
      addToast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setDeletingContactId(null);
    }
  };

  const copyCredentialsToClipboard = () => {
    if (!credentialsModal) return;
    const text =
      `*Credenciais de Acesso para Aprovação de Relatórios*\n\n` +
      `Nome: ${credentialsModal.name}\n` +
      `E-mail (Usuário): ${credentialsModal.email}\n` +
      `Senha Temporária: ${credentialsModal.tempPassword}\n\n` +
      `Instruções: No primeiro acesso para aprovar o relatório compartilhado, você usará esta senha temporária e o sistema solicitará o cadastro imediato da sua nova senha pessoal permanente.`;

    navigator.clipboard.writeText(text);
    setCopiedCredential(true);
    setTimeout(() => setCopiedCredential(false), 2500);
    addToast({ title: 'Copiado!', description: 'Credenciais formatadas copiadas com sucesso.', variant: 'default' });
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

                  {/* Client Contacts & Approvers section */}
                  <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
                        <Users className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="font-medium text-2xs uppercase tracking-wider">
                          Contatos ({client.Contacts?.length || client.contacts?.length || 0})
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenContacts(client)}
                        className="h-7 px-2.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
                      >
                        <Users className="w-3.5 h-3.5 mr-1 text-indigo-500" />
                        <span>Gerenciar Contatos</span>
                      </Button>
                    </div>

                    {((client.Contacts && client.Contacts.length > 0) || (client.contacts && client.contacts.length > 0)) && (
                      <div className="mt-2 space-y-1.5">
                        {(client.Contacts || client.contacts || []).slice(0, 2).map((c) => (
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
                        {(client.Contacts?.length || client.contacts?.length || 0) > 2 && (
                          <p className="text-3xs text-neutral-400 text-right">
                            +{(client.Contacts?.length || client.contacts?.length || 0) - 2} outro(s) contato(s)
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

      {/* Contacts Management Modal */}
      {currentContactClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-neutral-900 dark:text-neutral-100 text-base">
                    Contatos & Aprovadores
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Cliente: <span className="font-semibold text-neutral-800 dark:text-neutral-200">{currentContactClient.name}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setContactClient(null)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Existing Contacts List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider text-2xs">
                    Contatos Cadastrados ({currentContactClient.Contacts?.length || currentContactClient.contacts?.length || 0})
                  </h4>
                  <span className="text-2xs text-neutral-400">
                    O e-mail atua como login para aprovar relatórios
                  </span>
                </div>

                {(!currentContactClient.Contacts || currentContactClient.Contacts.length === 0) &&
                (!currentContactClient.contacts || currentContactClient.contacts.length === 0) ? (
                  <div className="p-5 rounded-lg border border-dashed border-neutral-200 dark:border-neutral-800 text-center bg-neutral-50/50 dark:bg-neutral-900/50">
                    <UserCheck className="w-8 h-8 mx-auto text-neutral-300 dark:text-neutral-600 mb-1.5" />
                    <p className="font-medium text-neutral-600 dark:text-neutral-300 text-xs">
                      Nenhum contato cadastrado ainda
                    </p>
                    <p className="text-2xs text-neutral-400 mt-0.5">
                      Adicione um contato abaixo para gerar sua senha temporária de acesso.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(currentContactClient.Contacts || currentContactClient.contacts || []).map((contact) => (
                      <div
                        key={contact.id}
                        className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                              {contact.name}
                            </span>
                            {contact.role && (
                              <span className="text-2xs px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                                {contact.role}
                              </span>
                            )}
                            {contact.must_change_password ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-3xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                <ShieldAlert className="w-3 h-3 text-amber-600" />
                                <span>1º Acesso Pendente (Senha Temporária)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-3xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                <span>Senha Definitiva Ativa</span>
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-neutral-500 dark:text-neutral-400">
                            <div className="flex items-center gap-1 font-mono text-neutral-700 dark:text-neutral-300">
                              <Mail className="w-3 h-3 text-neutral-400" />
                              <span>Login: {contact.email}</span>
                            </div>
                            {contact.phone && (
                              <div className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-neutral-400" />
                                <span>{contact.phone}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-200 dark:border-neutral-800">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={resettingContactId === contact.id}
                            onClick={() => handleResetContactPassword(contact)}
                            className="gap-1.5 text-xs text-neutral-700 dark:text-neutral-300 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer h-7 px-2"
                            title="Gera uma nova senha temporária e exige troca no próximo acesso"
                          >
                            <RefreshCw className={`w-3 h-3 ${resettingContactId === contact.id ? 'animate-spin' : ''}`} />
                            <span>Nova Senha</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={deletingContactId === contact.id}
                            onClick={() => handleDeleteContact(contact.id)}
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700 dark:hover:text-red-400 cursor-pointer"
                            title="Excluir contato"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add New Contact Form */}
              <div className="p-4 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 space-y-4">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h4 className="font-bold text-neutral-900 dark:text-neutral-100 text-xs">
                    Cadastrar Novo Contato & Gerar Senha
                  </h4>
                </div>
                <p className="text-2xs text-neutral-600 dark:text-neutral-400">
                  O sistema gerará automaticamente uma senha temporária aleatória. No primeiro acesso para aprovação, o contato será obrigado a cadastrar sua nova senha pessoal permanente.
                </p>

                <form onSubmit={handleAddContact} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-2xs font-semibold text-neutral-700 dark:text-neutral-300">
                        Nome do Contato *
                      </label>
                      <Input
                        value={newContactName}
                        onChange={(e) => setNewContactName(e.target.value)}
                        placeholder="Ex: Mariana Silva"
                        required
                        className="text-xs h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-2xs font-semibold text-neutral-700 dark:text-neutral-300">
                        E-mail de Login *
                      </label>
                      <Input
                        type="email"
                        value={newContactEmail}
                        onChange={(e) => setNewContactEmail(e.target.value)}
                        placeholder="mariana@cliente.com"
                        required
                        className="text-xs h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-2xs font-semibold text-neutral-700 dark:text-neutral-300">
                        Cargo / Função
                      </label>
                      <Input
                        value={newContactRole}
                        onChange={(e) => setNewContactRole(e.target.value)}
                        placeholder="Ex: Diretora Financeira"
                        className="text-xs h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-2xs font-semibold text-neutral-700 dark:text-neutral-300">
                        Telefone / WhatsApp
                      </label>
                      <Input
                        value={newContactPhone}
                        onChange={(e) => setNewContactPhone(e.target.value)}
                        placeholder="(11) 98765-4321"
                        className="text-xs h-8"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="submit"
                      disabled={submittingContact}
                      className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{submittingContact ? 'Cadastrando...' : 'Cadastrar Contato e Gerar Senha'}</span>
                    </Button>
                  </div>
                </form>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850 flex justify-end shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setContactClient(null)}
                className="cursor-pointer text-xs"
              >
                Concluído
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Generated Credentials Popup Modal */}
      {credentialsModal?.open && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <KeyRound className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1">
                <h3 className="font-bold text-neutral-900 dark:text-neutral-100 text-base">
                  {credentialsModal.isReset ? 'Senha Temporária Redefinida' : 'Acesso de Contato Criado'}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Envie as credenciais abaixo para o cliente. No primeiro acesso para aprovação, ele deverá cadastrar uma nova senha pessoal.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 space-y-2.5 text-xs">
                <div>
                  <span className="text-2xs font-semibold text-neutral-400 uppercase tracking-wider block">
                    Nome do Contato
                  </span>
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">
                    {credentialsModal.name}
                  </span>
                </div>
                <div>
                  <span className="text-2xs font-semibold text-neutral-400 uppercase tracking-wider block">
                    E-mail / Usuário de Login
                  </span>
                  <span className="font-mono text-neutral-900 dark:text-neutral-100 font-medium">
                    {credentialsModal.email}
                  </span>
                </div>
                <div>
                  <span className="text-2xs font-semibold text-neutral-400 uppercase tracking-wider block">
                    Senha Temporária (Aleatória)
                  </span>
                  <div className="flex items-center justify-between gap-2 mt-1 p-2 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700">
                    <span className="font-mono text-base font-bold text-indigo-600 dark:text-indigo-400 tracking-wider">
                      {credentialsModal.tempPassword}
                    </span>
                    <span className="text-3xs px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 font-semibold">
                      Troca obrigatória no 1º acesso
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <Button
                  onClick={copyCredentialsToClipboard}
                  className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                >
                  {copiedCredential ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedCredential ? 'Credenciais Copiadas!' : 'Copiar Dados de Acesso para o Cliente'}</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCredentialsModal(null)}
                  className="w-full cursor-pointer"
                >
                  Fechar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
