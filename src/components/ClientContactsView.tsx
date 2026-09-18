import React, { useState } from 'react';
import {
  Users,
  ArrowLeft,
  Plus,
  Mail,
  Phone,
  KeyRound,
  Check,
  Trash2,
  RefreshCw,
  Copy,
  Briefcase,
  AlertTriangle,
  UserCheck,
  X,
} from 'lucide-react';
import { Client, ClientContact } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useToast } from './ui/toast';
import { apiFetch } from '../utils/api';

interface ClientContactsViewProps {
  clientId: string;
  clients: Client[];
  onRefreshClients: () => Promise<void>;
  onBack: () => void;
}

export function ClientContactsView({
  clientId,
  clients,
  onRefreshClients,
  onBack,
}: ClientContactsViewProps) {
  const { addToast } = useToast();

  const client = clients.find((c) => c.id === clientId);

  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactRole, setNewContactRole] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [submittingContact, setSubmittingContact] = useState(false);
  const [resettingContactId, setResettingContactId] = useState<string | null>(null);
  const [deletingContactId, setDeletingContactId] = useState<string | null>(null);

  // Generated credentials box state
  const [generatedCredential, setGeneratedCredential] = useState<{
    name: string;
    email: string;
    tempPassword: string;
    isReset?: boolean;
  } | null>(null);
  const [copiedCredential, setCopiedCredential] = useState(false);

  const contacts = client ? client.Contacts || client.contacts || [] : [];

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;

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
      const res = await apiFetch(`/api/clients/${client.id}/contacts`, {
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

      setGeneratedCredential({
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
    if (!client) return;
    setResettingContactId(contact.id);
    try {
      const res = await apiFetch(`/api/clients/${client.id}/contacts/${contact.id}/reset-password`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao redefinir senha');

      addToast({ title: 'Nova senha temporária gerada!', variant: 'default' });
      await onRefreshClients();

      setGeneratedCredential({
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
    if (!client) return;
    setDeletingContactId(contactId);
    try {
      const res = await apiFetch(`/api/clients/${client.id}/contacts/${contactId}`, {
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
    if (!generatedCredential) return;
    const text =
      `*Credenciais de Acesso para Aprovação de Relatórios*\n\n` +
      `Nome: ${generatedCredential.name}\n` +
      `E-mail (Usuário): ${generatedCredential.email}\n` +
      `Senha Temporária: ${generatedCredential.tempPassword}\n\n` +
      `Instruções: No primeiro acesso para aprovar o relatório compartilhado, você usará esta senha temporária e o sistema solicitará o cadastro imediato da sua nova senha pessoal permanente.`;

    navigator.clipboard.writeText(text);
    setCopiedCredential(true);
    setTimeout(() => setCopiedCredential(false), 2500);
    addToast({ title: 'Copiado!', description: 'Credenciais formatadas copiadas com sucesso.', variant: 'default' });
  };

  if (!client) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto py-12 text-center">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-150">Cliente não encontrado</h3>
        <p className="text-xs text-neutral-500">O cliente solicitado não existe ou foi removido.</p>
        <Button onClick={onBack} className="mt-4">
          Voltar para Clientes
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-4xl mx-auto px-3 sm:px-6 py-4 pb-20 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200 dark:border-neutral-800 pb-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="gap-1.5 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 cursor-pointer h-10 sm:h-9 px-3 text-xs sm:text-sm"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span>Voltar para Clientes</span>
          </Button>
        </div>
        <div className="text-left sm:text-right">
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center sm:justify-end gap-2">
            <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>Gestão de Contatos</span>
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Cliente: <strong className="text-neutral-800 dark:text-neutral-200">{client.name}</strong>
          </p>
        </div>
      </div>

      {/* Generated Credential Success Banner */}
      {generatedCredential && (
        <div className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 p-4 sm:p-5 space-y-3 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs sm:text-sm text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                {generatedCredential.isReset ? 'Nova Senha Temporária Gerada' : 'Credencial de Acesso Gerada'}
              </span>
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setGeneratedCredential(null)}
              className="h-8 w-8 p-0 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-2xs sm:text-xs text-emerald-800 dark:text-emerald-300">
            Copie e envie os dados de acesso abaixo para o contato. A senha temporária expira após o primeiro login de alteração obrigatória.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-white dark:bg-neutral-900 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800 text-xs font-mono">
            <div>
              <span className="text-neutral-400 text-3xs sm:text-2xs block uppercase">Nome</span>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">{generatedCredential.name}</span>
            </div>
            <div>
              <span className="text-neutral-400 text-3xs sm:text-2xs block uppercase">E-mail (Login)</span>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100 break-all">{generatedCredential.email}</span>
            </div>
            <div>
              <span className="text-neutral-400 text-3xs sm:text-2xs block uppercase">Senha Temporária</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">{generatedCredential.tempPassword}</span>
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <Button
              onClick={copyCredentialsToClipboard}
              className="w-full sm:w-auto gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs h-10 sm:h-9 cursor-pointer"
            >
              {copiedCredential ? (
                <>
                  <Check className="w-4 h-4 text-emerald-200" />
                  <span>Copiado com Sucesso!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copiar Credenciais Formatadas</span>
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Main Grid: Add Contact Form & Contacts List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Add Contact Form */}
        <div className="lg:col-span-1 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 sm:p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2 border-b border-neutral-100 dark:border-neutral-800 pb-3">
            <Plus className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>Adicionar Contato</span>
          </h3>

          <form onSubmit={handleAddContact} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Nome do Contato *
              </label>
              <Input
                value={newContactName}
                onChange={(e) => setNewContactName(e.target.value)}
                placeholder="Ex: Carlos Gestor"
                required
                className="h-10 sm:h-9 text-xs sm:text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                E-mail (Login) *
              </label>
              <Input
                type="email"
                value={newContactEmail}
                onChange={(e) => setNewContactEmail(e.target.value)}
                placeholder="carlos@empresa.com"
                required
                className="h-10 sm:h-9 text-xs sm:text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Cargo / Função
              </label>
              <Input
                value={newContactRole}
                onChange={(e) => setNewContactRole(e.target.value)}
                placeholder="Ex: Gerente de Projetos"
                className="h-10 sm:h-9 text-xs sm:text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Telefone / WhatsApp
              </label>
              <Input
                value={newContactPhone}
                onChange={(e) => setNewContactPhone(e.target.value)}
                placeholder="(11) 99999-9999"
                className="h-10 sm:h-9 text-xs sm:text-sm"
              />
            </div>

            <Button
              type="submit"
              disabled={submittingContact}
              className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm h-11 sm:h-10 cursor-pointer font-medium mt-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>{submittingContact ? 'Cadastrando...' : 'Cadastrar Contato'}</span>
            </Button>
          </form>
        </div>

        {/* Right Column: Existing Contacts List */}
        <div className="lg:col-span-2 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>Contatos Cadastrados ({contacts.length})</span>
            </h3>
          </div>

          {contacts.length === 0 ? (
            <div className="py-12 text-center text-xs text-neutral-400 space-y-2">
              <Users className="w-10 h-10 mx-auto text-neutral-300 dark:text-neutral-700" />
              <p>Nenhum contato cadastrado para este cliente ainda.</p>
              <p className="text-2xs text-neutral-400 max-w-xs mx-auto">
                Adicione contatos para permitir que eles acessem e aprovem relatórios compartilhados.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-750 bg-neutral-50/50 dark:bg-neutral-850/50 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-sm flex items-center justify-center shrink-0 mt-0.5">
                        {contact.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="space-y-1 min-w-0">
                        <h4 className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 truncate">
                          {contact.name}
                        </h4>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs text-neutral-500 dark:text-neutral-400">
                          <span className="flex items-center gap-1.5 truncate">
                            <Mail className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                            <span className="truncate">{contact.email}</span>
                          </span>
                          {contact.phone && (
                            <span className="flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                              <span>{contact.phone}</span>
                            </span>
                          )}
                        </div>
                        {contact.role && (
                          <div>
                            <span className="inline-block px-2 py-0.5 rounded text-2xs bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-medium mt-1">
                              {contact.role}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="self-start sm:self-auto">
                      {contact.must_change_password ? (
                        <span
                          title="Primeiro acesso pendente"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>1º Acesso Pendente</span>
                        </span>
                      ) : (
                        <span
                          title="Senha definitiva cadastrada"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Ativo</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-3 border-t border-neutral-200/60 dark:border-neutral-750/60 text-xs">
                    <span className="text-neutral-400 font-mono text-2xs">
                      ID: {contact.id.substring(0, 8)}...
                    </span>
                    <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={resettingContactId === contact.id}
                        onClick={() => handleResetContactPassword(contact)}
                        className="h-9 sm:h-8 text-xs gap-1.5 cursor-pointer justify-center"
                        title="Gerar nova senha temporária para este contato"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span>{resettingContactId === contact.id ? 'Gerando...' : 'Resetar Senha'}</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={deletingContactId === contact.id}
                        onClick={() => handleDeleteContact(contact.id)}
                        className="h-9 sm:h-8 text-xs gap-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 border-red-200 dark:border-red-900 cursor-pointer justify-center"
                      >
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        <span>{deletingContactId === contact.id ? 'Excluindo...' : 'Excluir'}</span>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
