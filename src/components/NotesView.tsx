import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Search,
  Lock,
  Globe,
  Pin,
  Trash2,
  Calendar,
  Sparkles,
  CheckSquare,
  BookOpen
} from 'lucide-react';
import { NoteItem } from '../types';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { RichNoteEditor } from './RichNoteEditor';
import { apiFetch } from '../utils/api';

interface NotesViewProps {
  currentUserId: string;
  addToast: (toast: { title: string; description: string; variant?: 'success' | 'destructive' | 'default' | 'amber' }) => void;
}

export const NotesView: React.FC<NotesViewProps> = ({
  currentUserId,
  addToast,
}) => {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'mine' | 'shared'>('all');
  const [creating, setCreating] = useState(false);

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

      // If selected note is no longer in list or none selected, select first
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
          title: 'Nova Nota sem Título',
          content: '# Minha Nota\n\n- [ ] Tarefa 1\n- [ ] Tarefa 2\n\nEscreva suas anotações aqui...',
          is_workspace_shared: shared,
          is_pinned: false,
        }),
      });

      if (!res.ok) throw new Error('Falha ao criar nota');
      const data = await res.json();
      const newNote = data.note;

      setNotes((prev) => [newNote, ...prev]);
      setSelectedNoteId(newNote.id);
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
    return true; // 'all'
  });

  const selectedNote = notes.find((n) => n.id === selectedNoteId);

  return (
    <div className="max-w-7xl mx-auto space-y-6 h-[calc(100vh-140px)] flex flex-col">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <span>Bloco de Notas &amp; TODOs</span>
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Anotações rápidas, listas de tarefas e rascunhos para você e sua equipe no workspace.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => handleCreateNote(false)}
            disabled={creating}
            className="gap-1.5"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>+ Nota Pessoal</span>
          </Button>
          <Button
            onClick={() => handleCreateNote(true)}
            disabled={creating}
            className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>+ Nota da Equipe</span>
          </Button>
        </div>
      </div>

      {/* Main split layout with mobile-first responsive switching */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Sidebar notes list: Hidden on mobile when a note is selected */}
        <div className={`md:col-span-4 flex flex-col bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm ${selectedNoteId ? 'hidden md:flex' : 'flex'}`}>
          {/* Search & Tabs */}
          <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar notas ou TODOs..."
                className="w-full pl-9 pr-3 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center justify-between bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg text-2xs font-medium">
              <button
                onClick={() => setFilterTab('all')}
                className={`flex-1 py-1 px-2 rounded transition-all text-center ${
                  filterTab === 'all'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                }`}
              >
                Todas ({notes.length})
              </button>
              <button
                onClick={() => setFilterTab('mine')}
                className={`flex-1 py-1 px-2 rounded transition-all text-center ${
                  filterTab === 'mine'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                }`}
              >
                Pessoais
              </button>
              <button
                onClick={() => setFilterTab('shared')}
                className={`flex-1 py-1 px-2 rounded transition-all text-center ${
                  filterTab === 'shared'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                }`}
              >
                Equipe
              </button>
            </div>
          </div>

          {/* Notes list */}
          <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800">
            {loading ? (
              <div className="p-8 text-center text-neutral-400 text-xs">Carregando notas...</div>
            ) : filteredNotes.length === 0 ? (
              <div className="p-8 text-center text-neutral-400 space-y-3">
                <BookOpen className="w-8 h-8 mx-auto opacity-40" />
                <p className="text-xs">Nenhuma nota encontrada.</p>
                <Button variant="outline" size="sm" onClick={() => handleCreateNote(false)}>
                  Criar Primeira Nota
                </Button>
              </div>
            ) : (
              filteredNotes.map((note) => {
                const isSelected = note.id === selectedNoteId;
                return (
                  <div
                    key={note.id}
                    onClick={() => setSelectedNoteId(note.id)}
                    className={`p-3.5 cursor-pointer transition-colors text-left flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-l-4 border-indigo-600'
                        : 'hover:bg-neutral-50 dark:hover:bg-neutral-850/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 truncate flex items-center gap-1.5">
                        {note.is_pinned && <Pin className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />}
                        <span className="truncate">{note.title || 'Sem Título'}</span>
                      </span>
                      {note.is_workspace_shared ? (
                        <span title="Compartilhada com a equipe">
                          <Globe className="w-3 h-3 text-indigo-500 shrink-0" />
                        </span>
                      ) : (
                        <span title="Privada">
                          <Lock className="w-3 h-3 text-neutral-400 shrink-0" />
                        </span>
                      )}
                    </div>

                    <p className="text-2xs text-neutral-500 dark:text-neutral-400 line-clamp-2 font-mono">
                      {note.content ? note.content.replace(/[#*_-]/g, '') : 'Nota vazia...'}
                    </p>

                    <div className="flex items-center justify-between text-2xs text-neutral-400 pt-1">
                      <span>{note.Author?.name || 'Você'}</span>
                      <span>{new Date(note.updated_at || Date.now()).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Editor Area: Hidden on mobile when no note is selected, shown full width on mobile when selected */}
        <div className={`md:col-span-8 flex flex-col h-full min-h-[400px] ${!selectedNoteId ? 'hidden md:flex' : 'flex'}`}>
          {selectedNote ? (
            <div className="flex flex-col h-full">
              {/* Mobile back button header */}
              <div className="md:hidden pb-2 flex items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedNoteId(null)}
                  className="gap-1 text-xs text-indigo-600 dark:text-indigo-400 px-2 h-8"
                >
                  ← Voltar para lista de notas
                </Button>
              </div>
              <div className="flex-1 min-h-0">
                <RichNoteEditor
                  note={selectedNote}
                  currentUserId={currentUserId}
                  onUpdate={(updatedData) => handleUpdateNote(selectedNote.id, updatedData)}
                  onDelete={() => handleDeleteNote(selectedNote.id)}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-8 text-center text-neutral-400">
              <FileText className="w-12 h-12 opacity-30 mb-3 text-indigo-500" />
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Nenhuma nota selecionada</h3>
              <p className="text-xs max-w-sm mt-1 mb-4">
                Selecione uma nota ao lado ou crie uma nova nota pessoal ou da equipe para comecar.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button size="sm" onClick={() => handleCreateNote(false)}>+ Nota Pessoal</Button>
                <Button size="sm" variant="outline" onClick={() => handleCreateNote(true)}>+ Nota da Equipe</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
