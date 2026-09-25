import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Lock,
  Globe,
  Pin,
  Calendar,
  BookOpen,
  PanelLeftClose,
  PanelLeft,
  Plus,
} from 'lucide-react';
import { NoteItem } from '../types';
import { Button } from './ui/button';
import { RichNoteEditor } from './RichNoteEditor';
import { apiFetch } from '../utils/api';

interface NotesViewProps {
  currentUserId: string;
  addToast: (toast: { title: string; description: string; variant?: 'success' | 'destructive' | 'default' | 'amber' }) => void;
  isDrawer?: boolean;
}

export const NotesView: React.FC<NotesViewProps> = ({
  currentUserId,
  addToast,
  isDrawer = false,
}) => {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'mine' | 'shared'>('all');
  const [creating, setCreating] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/notes', {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Falha ao buscar notas');
      const data = await res.json();
      const list = data.notes || [];
      setNotes(list);

      if (list.length > 0 && (!selectedNoteId || !list.find((n: NoteItem) => n.id === selectedNoteId))) {
        setSelectedNoteId(list[0].id);
      } else if (list.length === 0) {
        setSelectedNoteId(null);
      }
    } catch (err: any) {
      console.error('Error fetching notes:', err);
      addToast({
        title: 'Erro',
        description: 'Não foi possível carregar as notas.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
    const handleWsChange = () => fetchNotes();
    window.addEventListener('workspace-changed', handleWsChange);
    return () => window.removeEventListener('workspace-changed', handleWsChange);
  }, []);

  const handleCreateNote = async (shared: boolean = false) => {
    try {
      setCreating(true);
      const res = await apiFetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Nova Nota',
          content: '# Minha Nota\n\n- [ ] Tarefa pendente\n\nEscreva suas anotações aqui...',
          is_workspace_shared: shared,
          is_pinned: false,
        }),
      });

      if (!res.ok) throw new Error('Falha ao criar nota');
      const data = await res.json();
      const newNote = data.note;

      setNotes((prev) => [newNote, ...prev]);
      setSelectedNoteId(newNote.id);
      // Ensure sidebar is open or note is focused
      if (!isSidebarOpen) setIsSidebarOpen(true);
      addToast({
        title: 'Nota criada',
        description: 'Nova nota adicionada com sucesso.',
        variant: 'success',
      });
    } catch (err: any) {
      addToast({
        title: 'Erro ao criar',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateNote = async (id: string, updatedData: { title?: string; content?: string; is_workspace_shared?: boolean; is_pinned?: boolean }) => {
    const res = await apiFetch(`/api/notes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Falha ao atualizar nota');
    }

    const data = await res.json();
    const updated = data.note;

    setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)));
  };

  const handleDeleteNote = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta nota?')) return;

    try {
      const res = await apiFetch(`/api/notes/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Falha ao excluir nota');

      setNotes((prev) => {
        const filtered = prev.filter((n) => n.id !== id);
        if (selectedNoteId === id) {
          setSelectedNoteId(filtered.length > 0 ? filtered[0].id : null);
        }
        return filtered;
      });

      addToast({
        title: 'Nota excluída',
        description: 'A nota foi removida com sucesso.',
        variant: 'success',
      });
    } catch (err: any) {
      addToast({
        title: 'Erro ao excluir',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  // Filtering notes
  const filteredNotes = notes.filter((note) => {
    const matchesSearch =
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterTab === 'mine') {
      return note.user_id === currentUserId && !note.is_workspace_shared;
    }
    if (filterTab === 'shared') {
      return note.is_workspace_shared;
    }
    return true;
  });

  const selectedNote = notes.find((n) => n.id === selectedNoteId);

  return (
    <div className={`w-full flex flex-col ${isDrawer ? 'h-full' : 'h-[calc(100vh-115px)] max-w-7xl mx-auto space-y-3'}`}>
      {/* Header section (Only in standard view or compact bar in drawer) */}
      {!isDrawer ? (
        <div className="flex flex-wrap items-center justify-between gap-3 shrink-0 pb-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100 leading-none">
                Bloco de Notas &amp; TODOs
              </h1>
              <p className="text-2xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Anotações e listas de tarefas do workspace
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCreateNote(false)}
              disabled={creating}
              className="h-7 px-2.5 text-xs gap-1 cursor-pointer whitespace-nowrap"
            >
              <Lock className="w-3 h-3 text-neutral-500" />
              <span>+ Pessoal</span>
            </Button>
            <Button
              size="sm"
              onClick={() => handleCreateNote(true)}
              disabled={creating}
              className="h-7 px-2.5 text-xs gap-1 bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer whitespace-nowrap"
            >
              <Globe className="w-3 h-3 text-white" />
              <span>+ Equipe</span>
            </Button>
          </div>
        </div>
      ) : (
        /* Drawer Top Bar: sleek, tight, action-oriented */
        <div className="flex items-center justify-between gap-2 pb-2 shrink-0 border-b border-neutral-200 dark:border-neutral-800 mb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-500 transition-colors cursor-pointer"
              title={isSidebarOpen ? 'Ocultar lista de notas' : 'Mostrar lista de notas'}
            >
              {isSidebarOpen ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeft className="w-3.5 h-3.5" />}
            </button>
            <span>Notas ({notes.length})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCreateNote(false)}
              disabled={creating}
              className="h-6 px-2 text-2xs gap-1 cursor-pointer whitespace-nowrap"
            >
              <Lock className="w-2.5 h-2.5 text-neutral-500" />
              <span>+ Pessoal</span>
            </Button>
            <Button
              size="sm"
              onClick={() => handleCreateNote(true)}
              disabled={creating}
              className="h-6 px-2 text-2xs gap-1 bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer whitespace-nowrap"
            >
              <Globe className="w-2.5 h-2.5 text-white" />
              <span>+ Equipe</span>
            </Button>
          </div>
        </div>
      )}

      {/* Main split layout */}
      <div className="flex-1 flex gap-3 min-h-0 overflow-hidden">
        {/* Sidebar notes list */}
        {isSidebarOpen && (
          <div className={`flex flex-col bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-xs shrink-0 ${isDrawer ? 'w-56 sm:w-64' : 'w-full md:w-72 lg:w-80'} ${selectedNoteId && !isDrawer ? 'hidden md:flex' : 'flex'}`}>
            {/* Search & Tabs */}
            <div className="p-2 border-b border-neutral-200 dark:border-neutral-800 space-y-1.5 shrink-0 bg-neutral-50/50 dark:bg-neutral-900/50">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar notas..."
                  className="w-full pl-8 pr-2 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-2xs rounded-md focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-between bg-neutral-200/60 dark:bg-neutral-800 p-0.5 rounded-md text-2xs font-medium">
                <button
                  type="button"
                  onClick={() => setFilterTab('all')}
                  className={`flex-1 py-0.5 px-1 rounded transition-all text-center cursor-pointer truncate ${
                    filterTab === 'all'
                      ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs font-semibold'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                  }`}
                >
                  Todas ({notes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('mine')}
                  className={`flex-1 py-0.5 px-1 rounded transition-all text-center cursor-pointer truncate ${
                    filterTab === 'mine'
                      ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs font-semibold'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                  }`}
                >
                  Pessoais
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('shared')}
                  className={`flex-1 py-0.5 px-1 rounded transition-all text-center cursor-pointer truncate ${
                    filterTab === 'shared'
                      ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs font-semibold'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                  }`}
                >
                  Equipe
                </button>
              </div>
            </div>

            {/* Notes list items */}
            <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800">
              {loading ? (
                <div className="p-6 text-center text-neutral-400 text-2xs">Carregando...</div>
              ) : filteredNotes.length === 0 ? (
                <div className="p-6 text-center text-neutral-400 space-y-2">
                  <BookOpen className="w-6 h-6 mx-auto opacity-30 text-neutral-400" />
                  <p className="text-2xs">Nenhuma nota encontrada.</p>
                  <button
                    type="button"
                    onClick={() => handleCreateNote(false)}
                    className="text-2xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    + Criar nota
                  </button>
                </div>
              ) : (
                filteredNotes.map((note) => {
                  const isSelected = note.id === selectedNoteId;
                  return (
                    <div
                      key={note.id}
                      onClick={() => setSelectedNoteId(note.id)}
                      className={`px-3 py-2 cursor-pointer transition-colors text-left flex flex-col gap-0.5 ${
                        isSelected
                          ? 'bg-indigo-50/80 dark:bg-indigo-950/50 border-l-2 border-indigo-600'
                          : 'hover:bg-neutral-50 dark:hover:bg-neutral-850/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5 min-w-0">
                        <span className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 truncate flex items-center gap-1 min-w-0">
                          {note.is_pinned && <Pin className="w-2.5 h-2.5 text-amber-500 fill-amber-500 shrink-0" />}
                          <span className="truncate">{note.title || 'Sem Título'}</span>
                        </span>
                        {note.is_workspace_shared ? (
                          <span title="Compartilhada com a equipe" className="shrink-0">
                            <Globe className="w-2.5 h-2.5 text-indigo-500" />
                          </span>
                        ) : (
                          <span title="Privada" className="shrink-0">
                            <Lock className="w-2.5 h-2.5 text-neutral-400" />
                          </span>
                        )}
                      </div>

                      <p className="text-2xs text-neutral-500 dark:text-neutral-400 truncate font-sans">
                        {note.content ? note.content.replace(/[#*_-]/g, '').trim() : 'Nota vazia...'}
                      </p>

                      <div className="flex items-center justify-between text-3xs text-neutral-400 pt-0.5">
                        <span className="truncate max-w-[90px]">{note.Author?.name || 'Você'}</span>
                        <span className="shrink-0">{new Date(note.updated_at || Date.now()).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Editor Area */}
        <div className={`flex-1 flex flex-col h-full min-h-0 overflow-hidden ${!selectedNoteId && !isDrawer ? 'hidden md:flex' : 'flex'}`}>
          {selectedNote ? (
            <div className="flex flex-col h-full min-h-0">
              {/* Mobile back button */}
              <div className="md:hidden pb-1 flex items-center">
                <button
                  type="button"
                  onClick={() => setSelectedNoteId(null)}
                  className="text-2xs text-indigo-600 dark:text-indigo-400 font-medium py-1 px-2 rounded hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
                >
                  ← Ver lista de notas
                </button>
              </div>

              <div className="flex-1 min-h-0">
                <RichNoteEditor
                  note={selectedNote}
                  currentUserId={currentUserId}
                  onUpdate={(updatedData) => handleUpdateNote(selectedNote.id, updatedData)}
                  onDelete={() => handleDeleteNote(selectedNote.id)}
                  onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                  isSidebarOpen={isSidebarOpen}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 text-center text-neutral-400">
              <FileText className="w-8 h-8 opacity-30 mb-2 text-indigo-500" />
              <h3 className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Nenhuma nota selecionada</h3>
              <p className="text-2xs max-w-xs mt-1 mb-3">
                Selecione uma nota da lista ou crie uma nova para começar a escrever.
              </p>
              <div className="flex items-center gap-1.5">
                <Button size="sm" onClick={() => handleCreateNote(false)} className="h-7 px-2.5 text-2xs cursor-pointer">
                  + Pessoal
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleCreateNote(true)} className="h-7 px-2.5 text-2xs cursor-pointer">
                  + Equipe
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
