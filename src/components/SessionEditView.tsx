import React, { useState } from 'react';
import {
  Clock,
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Check,
  X,
  ExternalLink,
  Lock,
  Briefcase,
  AlertTriangle,
} from 'lucide-react';
import { TimeSession, Client } from '../types';
import { Button } from './ui/button';
import { useToast } from './ui/toast';
import { formatCurrency, formatDurationHuman } from '../utils/format';
import { TaskLinkCard } from './TaskLinkCard';

interface EditTaskItem {
  id?: string;
  description: string;
  notes?: string | null;
  link?: string | null;
  is_deleted?: boolean;
}

interface SessionEditViewProps {
  session: TimeSession | null;
  clients: Client[];
  hourlyRate: number;
  onUpdateSession: (
    sessionId: string,
    data: {
      title?: string;
      hourly_rate?: number | null;
      notes?: string | null;
      client_id?: string | null;
      tasks?: EditTaskItem[];
    }
  ) => Promise<void>;
  onBack: () => void;
}

export function SessionEditView({
  session,
  clients,
  hourlyRate,
  onUpdateSession,
  onBack,
}: SessionEditViewProps) {
  const { addToast } = useToast();

  if (!session) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto px-4 py-12 text-center animate-in fade-in duration-200">
        <div className="p-4 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 w-16 h-16 mx-auto flex items-center justify-center">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
          Sessão não encontrada
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          A sessão de trabalho solicitada não existe ou foi removida.
        </p>
        <div>
          <Button onClick={onBack} variant="outline" className="gap-2 cursor-pointer">
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar ao Histórico</span>
          </Button>
        </div>
      </div>
    );
  }

  const start = new Date(session.start_time).getTime();
  const end = session.end_time ? new Date(session.end_time).getTime() : Date.now();
  const durationSecs = Math.max(0, Math.floor((end - start) / 1000));
  const isLocked = session.is_locked;

  const [editTitle, setEditTitle] = useState(session.title || '');
  const [editHourlyRate, setEditHourlyRate] = useState(
    session.hourly_rate !== null && session.hourly_rate !== undefined
      ? session.hourly_rate.toString()
      : ''
  );
  const [editClientId, setEditClientId] = useState(session.client_id || '');
  const [editNotes, setEditNotes] = useState(session.notes || '');

  const [editTasks, setEditTasks] = useState<EditTaskItem[]>(() => {
    if (session.Tasks && Array.isArray(session.Tasks)) {
      return session.Tasks.map((t) => ({
        id: t.id,
        description: t.description || '',
        notes: t.notes || null,
        link: t.link || null,
        is_deleted: false,
      }));
    }
    return [];
  });

  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskLink, setNewTaskLink] = useState('');
  const [newTaskNotes, setNewTaskNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleAddNewTaskToEdit = () => {
    if (!newTaskDesc.trim()) {
      addToast({ title: 'Descrição obrigatória', description: 'Informe a descrição da tarefa.', variant: 'destructive' });
      return;
    }
    setEditTasks((prev) => [
      ...prev,
      {
        description: newTaskDesc.trim(),
        link: newTaskLink.trim() || null,
        notes: newTaskNotes.trim() || null,
        is_deleted: false,
      },
    ]);
    setNewTaskDesc('');
    setNewTaskLink('');
    setNewTaskNotes('');
    setShowNewTaskForm(false);
  };

  const handleRemoveTaskFromEdit = (index: number) => {
    setEditTasks((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, is_deleted: true } : item))
    );
  };

  const handleRestoreTaskInEdit = (index: number) => {
    setEditTasks((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, is_deleted: false } : item))
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) {
      addToast({
        title: 'Sessão Bloqueada',
        description: 'Esta sessão está bloqueada por ter sido aprovada em relatório.',
        variant: 'destructive',
      });
      return;
    }

    if (!editTitle.trim()) {
      addToast({ title: 'Título obrigatório', description: 'Informe o título da sessão.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const parsedRate = editHourlyRate.trim() === '' ? null : parseFloat(editHourlyRate);
      await onUpdateSession(session.id, {
        title: editTitle.trim(),
        hourly_rate: parsedRate !== null && !isNaN(parsedRate) ? parsedRate : null,
        client_id: editClientId.trim() || null,
        notes: editNotes.trim() || null,
        tasks: editTasks,
      });

      addToast({ title: 'Sessão atualizada com sucesso!', variant: 'default' });
      onBack();
    } catch (err: any) {
      addToast({ title: 'Erro ao salvar', description: err.message || 'Erro inesperado', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-3xl mx-auto px-3 sm:px-6 py-4 pb-24 animate-in fade-in duration-200">
      {/* Header with Back button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200 dark:border-neutral-800 pb-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="gap-1.5 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 cursor-pointer h-10 sm:h-9 px-3 text-xs sm:text-sm"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span>Voltar ao Histórico</span>
          </Button>
        </div>
        <h2 className="text-lg sm:text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span>Editar Sessão de Trabalho</span>
        </h2>
      </div>

      {isLocked && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-3">
          <Lock className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <span className="font-semibold block mb-0.5">Sessão Bloqueada no Banco de Dados</span>
            <span>Esta sessão já foi aprovada em relatório público e não pode ser alterada.</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5 sm:space-y-6">
        {/* Main Details Card */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 border-b border-neutral-100 dark:border-neutral-800 pb-3 flex items-center justify-between">
            <span>Informações da Sessão</span>
            <span className="text-2xs font-normal text-neutral-400">
              Duração: {formatDurationHuman(durationSecs)}
            </span>
          </h3>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              Título da Sessão <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={editTitle}
              disabled={isLocked}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Ex: Refatoração da API e Correção de Bugs"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-60"
            />
          </div>

          {/* Hourly Rate & Client */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                <span>Valor da Hora (R$/h)</span>
                <span className="text-2xs font-normal text-neutral-400">Personalizado</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400">
                  R$
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  disabled={isLocked}
                  value={editHourlyRate}
                  onChange={(e) => setEditHourlyRate(e.target.value)}
                  placeholder={`${session.Client?.hourly_rate ?? hourlyRate} (padrão)`}
                  className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono disabled:opacity-60"
                />
              </div>
              <p className="text-2xs text-neutral-400">
                Deixe vazio para usar a taxa do cliente (R$ {session.Client?.hourly_rate ?? hourlyRate}/h).
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Cliente Vinculado
              </label>
              <select
                value={editClientId}
                disabled={isLocked}
                onChange={(e) => setEditClientId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-60"
              >
                <option value="">Nenhum cliente (Geral)</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.hourly_rate ? `(R$ ${c.hourly_rate}/h)` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Session Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
              <span>Observações Gerais da Sessão</span>
              <span className="text-2xs font-normal text-neutral-400">Opcional</span>
            </label>
            <textarea
              rows={3}
              disabled={isLocked}
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Insira detalhes gerais, contexto, links ou anotações desta sessão de trabalho..."
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-y disabled:opacity-60"
            />
          </div>
        </div>

        {/* Tasks Section Card */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              Tarefas e Anotações ({editTasks.filter((t) => !t.is_deleted).length})
            </h3>
            {!isLocked && !showNewTaskForm && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowNewTaskForm(true)}
                className="h-8 px-3 text-xs gap-1.5 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Adicionar Tarefa</span>
              </Button>
            )}
          </div>

          {/* Add New Task Form */}
          {showNewTaskForm && !isLocked && (
            <div className="p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-300">
                  Nova Tarefa
                </span>
                <button
                  type="button"
                  onClick={() => setShowNewTaskForm(false)}
                  className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <input
                type="text"
                value={newTaskDesc}
                onChange={(e) => setNewTaskDesc(e.target.value)}
                placeholder="Descrição da tarefa..."
                className="w-full px-3.5 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <input
                type="url"
                value={newTaskLink}
                onChange={(e) => setNewTaskLink(e.target.value)}
                placeholder="Link do commit (opcional, ex: https://github.com/...)"
                className="w-full px-3.5 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <textarea
                rows={3}
                value={newTaskNotes}
                onChange={(e) => setNewTaskNotes(e.target.value)}
                placeholder="Observações da tarefa (opcional)..."
                className="w-full px-3.5 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y"
              />
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNewTaskForm(false)}
                  className="h-8 px-3 text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddNewTaskToEdit}
                  className="h-8 px-4 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  Salvar
                </Button>
              </div>
            </div>
          )}

          {/* Tasks List */}
          <div className="space-y-3">
            {editTasks.filter((t) => !t.is_deleted).length === 0 && !showNewTaskForm ? (
              <p className="text-xs text-neutral-400 italic py-3 text-center">
                Nenhuma tarefa associada a esta sessão. Clique em "Adicionar Tarefa" acima.
              </p>
            ) : (
              editTasks.map((t, idx) => {
                if (t.is_deleted) {
                  return (
                    <div
                      key={t.id || idx}
                      className="flex items-center justify-between p-3 rounded-xl bg-red-50/50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-900/40 text-xs text-neutral-400 line-through"
                    >
                      <span className="truncate flex-1">{t.description}</span>
                      {!isLocked && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRestoreTaskInEdit(idx)}
                          className="h-7 px-2.5 text-2xs text-red-600 dark:text-red-400 no-underline cursor-pointer"
                        >
                          Restaurar
                        </Button>
                      )}
                    </div>
                  );
                }

                return (
                  <div
                    key={t.id || idx}
                    className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-850/50 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <input
                        type="text"
                        value={t.description}
                        disabled={isLocked}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditTasks((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, description: val } : item))
                          );
                        }}
                        placeholder="Descrição da tarefa"
                        className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium disabled:opacity-60"
                      />
                      {!isLocked && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveTaskFromEdit(idx)}
                          className="h-8 w-8 p-0 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 shrink-0 cursor-pointer"
                          title="Remover tarefa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    {/* Task Link */}
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        value={t.link || ''}
                        disabled={isLocked}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditTasks((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, link: val || null } : item))
                          );
                        }}
                        placeholder="Link do commit (ex: https://github.com/...)"
                        className="flex-1 px-3.5 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white/70 dark:bg-neutral-800/70 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                      />
                      {t.link && (
                        <a
                          href={t.link}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg shrink-0 cursor-pointer"
                          title="Abrir URL em nova aba"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>

                    {/* Task Notes */}
                    <textarea
                      rows={3}
                      value={t.notes || ''}
                      disabled={isLocked}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditTasks((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, notes: val } : item))
                        );
                      }}
                      placeholder="Observações da tarefa (opcional)..."
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white/70 dark:bg-neutral-800/70 text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y disabled:opacity-60"
                    />

                    {/* Link Metadata Card if notes contain a link */}
                    <TaskLinkCard notes={t.notes} link={t.link} />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Form Footer Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="cursor-pointer text-xs h-11 sm:h-10 w-full sm:w-auto"
          >
            Cancelar
          </Button>
          {!isLocked && (
            <Button
              type="submit"
              disabled={isSaving}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer text-xs h-11 sm:h-10 w-full sm:w-auto shadow-sm"
            >
              <Save className="w-4 h-4 shrink-0" />
              <span>{isSaving ? 'Salvando...' : 'Salvar Alterações'}</span>
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
