import React, { useState, useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  CheckSquare,
  Code,
  Link as LinkIcon,
  Eye,
  Edit3,
  Lock,
  Globe,
  Pin,
  Trash2,
  Check,
  Loader2,
  Share2
} from 'lucide-react';
import { NoteItem } from '../types';
import { Button } from './ui/button';

interface RichNoteEditorProps {
  note: NoteItem;
  currentUserId: string;
  onUpdate: (updatedData: { title?: string; content?: string; is_workspace_shared?: boolean; is_pinned?: boolean }) => Promise<void>;
  onDelete: () => Promise<void>;
}

export const RichNoteEditor: React.FC<RichNoteEditorProps> = ({
  note,
  currentUserId,
  onUpdate,
  onDelete,
}) => {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content || '');
  const [isShared, setIsShared] = useState(note.is_workspace_shared);
  const [isPinned, setIsPinned] = useState(note.is_pinned || false);
  const [viewMode, setViewMode] = useState<'edit' | 'split' | 'preview'>('edit');
  const [savingStatus, setSavingStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setTitle(note.title);
    setContent(note.content || '');
    setIsShared(note.is_workspace_shared);
    setIsPinned(note.is_pinned || false);
  }, [note.id]);

  // Auto-save debounced
  const triggerAutoSave = (newTitle: string, newContent: string, newShared: boolean, newPinned: boolean) => {
    setSavingStatus('unsaved');
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        setSavingStatus('saving');
        await onUpdate({
          title: newTitle,
          content: newContent,
          is_workspace_shared: newShared,
          is_pinned: newPinned,
        });
        setSavingStatus('saved');
      } catch (err) {
        console.error('Auto-save error:', err);
        setSavingStatus('unsaved');
      }
    }, 800);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    triggerAutoSave(val, content, isShared, isPinned);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    triggerAutoSave(title, val, isShared, isPinned);
  };

  const handleToggleShared = () => {
    const nextVal = !isShared;
    setIsShared(nextVal);
    triggerAutoSave(title, content, nextVal, isPinned);
  };

  const handleTogglePin = () => {
    const nextVal = !isPinned;
    setIsPinned(nextVal);
    triggerAutoSave(title, content, isShared, nextVal);
  };

  // Markdown toolbar helper
  const insertFormatting = (prefix: string, suffix: string = '', defaultText: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end) || defaultText;
    const replacement = prefix + selectedText + suffix;

    const newContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(newContent);
    triggerAutoSave(title, newContent, isShared, isPinned);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
    }, 0);
  };

  const insertTask = () => {
    insertFormatting('- [ ] ', '', 'Nova tarefa pendente');
  };

  // Intercept markdown checkbox clicks in preview mode
  const handleMarkdownCheckboxClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target && target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox') {
      const checkbox = target as HTMLInputElement;
      // Find corresponding markdown line in content and toggle [ ] to [x] or vice versa
      // Simple approximation: toggle nearest `- [ ]` or `- [x]`
      const isChecked = checkbox.checked;
      // We can let react-markdown handle rendering, but to make checkboxes truly interactive in preview:
      // Let's parse text lines and toggle the N-th checkbox found in content
      const allCheckboxes = Array.from(textareaRef.current?.form?.querySelectorAll('input[type="checkbox"]') || []);
      const index = allCheckboxes.indexOf(checkbox);
      if (index !== -1) {
        let count = 0;
        const newContent = content.replace(/- \[[ x]\]/g, (match) => {
          if (count === index) {
            count++;
            return isChecked ? '- [x]' : '- [ ]';
          }
          count++;
          return match;
        });
        setContent(newContent);
        triggerAutoSave(title, newContent, isShared, isPinned);
      }
    }
  };

  const canEdit = note.user_id === currentUserId || isShared;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm">
      {/* Editor Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            placeholder="Título da nota..."
            className="w-full bg-transparent font-semibold text-lg text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Status saving indicator */}
          <span className="text-2xs text-neutral-400 dark:text-neutral-500 flex items-center gap-1 font-medium">
            {savingStatus === 'saving' && (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />
                <span>Salvando...</span>
              </>
            )}
            {savingStatus === 'saved' && (
              <>
                <Check className="w-3 h-3 text-emerald-500" />
                <span>Salvo</span>
              </>
            )}
            {savingStatus === 'unsaved' && <span>Alterado</span>}
          </span>

          {/* Privacy Toggle Button */}
          <button
            onClick={handleToggleShared}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              isShared
                ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700'
            }`}
            title={isShared ? 'Nota compartilhada com o workspace' : 'Nota privada (apenas você)'}
          >
            {isShared ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            <span>{isShared ? 'Equipe' : 'Privada'}</span>
          </button>

          {/* Pin Button */}
          <button
            onClick={handleTogglePin}
            className={`p-1.5 rounded-lg transition-colors ${
              isPinned
                ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400'
                : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
            title={isPinned ? 'Desafixar nota' : 'Fixar no topo'}
          >
            <Pin className="w-4 h-4" />
          </button>

          {/* View Mode toggles */}
          <div className="hidden sm:flex items-center bg-neutral-200/60 dark:bg-neutral-800 p-0.5 rounded-lg">
            <button
              onClick={() => setViewMode('edit')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                viewMode === 'edit'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              Editar
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                viewMode === 'preview'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              Visualizar
            </button>
          </div>

          {/* Delete Button */}
          <button
            onClick={onDelete}
            className="p-1.5 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
            title="Excluir nota"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Toolbar (Visible in edit or split mode) */}
      {(viewMode === 'edit' || viewMode === 'split') && (
        <div className="flex flex-wrap items-center gap-1 px-3 py-1.5 bg-neutral-100/70 dark:bg-neutral-850/70 border-b border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400">
          <button
            onClick={() => insertFormatting('**', '**', 'texto em negrito')}
            className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"
            title="Negrito"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            onClick={() => insertFormatting('*', '*', 'texto em itálico')}
            className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"
            title="Itálico"
          >
            <Italic className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-neutral-300 dark:bg-neutral-700 mx-1" />
          <button
            onClick={() => insertFormatting('# ', '', 'Título 1')}
            className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"
            title="Título 1"
          >
            <Heading1 className="w-4 h-4" />
          </button>
          <button
            onClick={() => insertFormatting('## ', '', 'Título 2')}
            className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"
            title="Título 2"
          >
            <Heading2 className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-neutral-300 dark:bg-neutral-700 mx-1" />
          <button
            onClick={() => insertFormatting('- ', '', 'Item de lista')}
            className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"
            title="Lista com marcadores"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={insertTask}
            className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors flex items-center gap-1 text-xs font-medium"
            title="Adicionar Tarefa (TODO)"
          >
            <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden md:inline">TODO</span>
          </button>
          <div className="w-px h-4 bg-neutral-300 dark:bg-neutral-700 mx-1" />
          <button
            onClick={() => insertFormatting('`', '`', 'código')}
            className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"
            title="Código em linha"
          >
            <Code className="w-4 h-4" />
          </button>
          <button
            onClick={() => insertFormatting('[', '](https://)', 'texto do link')}
            className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"
            title="Link"
          >
            <LinkIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Editor / Preview Body */}
      <div className="flex-1 flex overflow-hidden">
        {(viewMode === 'edit' || viewMode === 'split') && (
          <div className={`flex-1 p-4 ${viewMode === 'split' ? 'border-r border-neutral-200 dark:border-neutral-800' : ''} flex flex-col`}>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              placeholder="Digite suas anotações, ideias ou listas de tarefas aqui... (use - [ ] para criar TODOs)"
              className="w-full flex-1 bg-transparent text-neutral-900 dark:text-neutral-100 font-mono text-sm leading-relaxed focus:outline-none resize-none"
            />
          </div>
        )}

        {(viewMode === 'preview' || viewMode === 'split') && (
          <div
            className="flex-1 p-5 overflow-y-auto prose dark:prose-invert max-w-none bg-neutral-50/30 dark:bg-neutral-900/30 text-sm"
            onClick={handleMarkdownCheckboxClick}
          >
            {content.trim() ? (
              <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
            ) : (
              <p className="text-neutral-400 italic">Pré-visualização vazia...</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
