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
  Lock,
  Globe,
  Pin,
  Trash2,
  Check,
  Loader2,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { NoteItem } from '../types';

interface RichNoteEditorProps {
  note: NoteItem;
  currentUserId: string;
  onUpdate: (updatedData: { title?: string; content?: string; is_workspace_shared?: boolean; is_pinned?: boolean }) => Promise<void>;
  onDelete: () => Promise<void>;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

export const RichNoteEditor: React.FC<RichNoteEditorProps> = ({
  note,
  currentUserId,
  onUpdate,
  onDelete,
  onToggleSidebar,
  isSidebarOpen = true,
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
    }, 700);
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
      const isChecked = checkbox.checked;
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

  return (
    <div className="flex flex-col h-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-xs">
      {/* Compact Editor Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70 shrink-0">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="p-1 rounded-md text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 transition-colors shrink-0"
              title={isSidebarOpen ? 'Recolher lista de notas' : 'Expandir lista de notas'}
            >
              {isSidebarOpen ? (
                <PanelLeftClose className="w-4 h-4" />
              ) : (
                <PanelLeft className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              )}
            </button>
          )}

          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            placeholder="Título da nota..."
            className="w-full bg-transparent font-medium text-sm sm:text-base text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 rounded px-1.5 py-0.5 truncate"
          />
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Status saving indicator */}
          <span className="text-2xs text-neutral-400 dark:text-neutral-500 hidden sm:flex items-center gap-1 font-medium whitespace-nowrap">
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
            type="button"
            onClick={handleToggleShared}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-2xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              isShared
                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700'
            }`}
            title={isShared ? 'Nota compartilhada com o workspace' : 'Nota privada (apenas você)'}
          >
            {isShared ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
            <span>{isShared ? 'Equipe' : 'Privada'}</span>
          </button>

          {/* Pin Button */}
          <button
            type="button"
            onClick={handleTogglePin}
            className={`p-1 rounded-md transition-colors cursor-pointer shrink-0 ${
              isPinned
                ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400'
                : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
            title={isPinned ? 'Desafixar nota' : 'Fixar no topo'}
          >
            <Pin className="w-3.5 h-3.5" />
          </button>

          {/* View Mode toggles */}
          <div className="flex items-center bg-neutral-200/70 dark:bg-neutral-800 p-0.5 rounded-md shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('edit')}
              className={`px-2 py-0.5 text-2xs font-medium rounded transition-all cursor-pointer whitespace-nowrap ${
                viewMode === 'edit'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`px-2 py-0.5 text-2xs font-medium rounded transition-all cursor-pointer whitespace-nowrap ${
                viewMode === 'preview'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              Ver
            </button>
          </div>

          {/* Delete Button */}
          <button
            type="button"
            onClick={onDelete}
            className="p-1 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-colors cursor-pointer shrink-0"
            title="Excluir nota"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Sleek Compact Toolbar */}
      {(viewMode === 'edit' || viewMode === 'split') && (
        <div className="flex items-center gap-0.5 px-2.5 py-1 bg-neutral-50 dark:bg-neutral-850/60 border-b border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 text-xs overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => insertFormatting('**', '**', 'negrito')}
            className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors cursor-pointer"
            title="Negrito"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('*', '*', 'itálico')}
            className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors cursor-pointer"
            title="Itálico"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-3.5 bg-neutral-300 dark:bg-neutral-700 mx-1 shrink-0" />
          <button
            type="button"
            onClick={() => insertFormatting('# ', '', 'Título 1')}
            className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors cursor-pointer"
            title="Título 1"
          >
            <Heading1 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('## ', '', 'Título 2')}
            className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors cursor-pointer"
            title="Título 2"
          >
            <Heading2 className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-3.5 bg-neutral-300 dark:bg-neutral-700 mx-1 shrink-0" />
          <button
            type="button"
            onClick={() => insertFormatting('- ', '', 'Item de lista')}
            className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors cursor-pointer"
            title="Lista com marcadores"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={insertTask}
            className="px-1.5 py-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors flex items-center gap-1 text-2xs font-semibold text-emerald-600 dark:text-emerald-400 cursor-pointer whitespace-nowrap"
            title="Adicionar Tarefa (TODO)"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>TODO</span>
          </button>
          <div className="w-px h-3.5 bg-neutral-300 dark:bg-neutral-700 mx-1 shrink-0" />
          <button
            type="button"
            onClick={() => insertFormatting('`', '`', 'código')}
            className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors cursor-pointer"
            title="Código em linha"
          >
            <Code className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('[', '](https://)', 'link')}
            className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors cursor-pointer"
            title="Link"
          >
            <LinkIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Editor / Preview Body */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {(viewMode === 'edit' || viewMode === 'split') && (
          <div className={`flex-1 p-3 sm:p-4 ${viewMode === 'split' ? 'border-r border-neutral-200 dark:border-neutral-800' : ''} flex flex-col min-h-0 overflow-hidden`}>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              placeholder="Escreva suas anotações ou tarefas aqui... (Dica: digite - [ ] para criar TODOs)"
              className="w-full flex-1 bg-transparent text-neutral-900 dark:text-neutral-100 font-sans text-xs sm:text-sm leading-relaxed focus:outline-hidden resize-none overflow-y-auto"
            />
          </div>
        )}

        {(viewMode === 'preview' || viewMode === 'split') && (
          <div
            className="flex-1 p-3 sm:p-4 overflow-y-auto prose prose-sm dark:prose-invert max-w-none bg-neutral-50/40 dark:bg-neutral-900/40 text-xs sm:text-sm leading-relaxed"
            onClick={handleMarkdownCheckboxClick}
          >
            {content.trim() ? (
              <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
            ) : (
              <p className="text-neutral-400 italic text-xs">Nota vazia...</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
