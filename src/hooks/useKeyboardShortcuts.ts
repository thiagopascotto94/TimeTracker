import { useEffect } from 'react';

export function isEditableElement(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tagName = el.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true;
  }
  if (el.isContentEditable) {
    return true;
  }
  return false;
}

export interface KeyboardShortcutsHandlers {
  onToggleTimer?: () => void;
  onOpenCommandPalette?: () => void;
  onCloseModals?: () => void;
  onOpenShortcutsHelp?: () => void;
}

/**
 * Centralized ergonomic keyboard shortcuts hook (Etapa 01).
 * Safe against collision with form inputs and textareas.
 */
export function useKeyboardShortcuts({
  onToggleTimer,
  onOpenCommandPalette,
  onCloseModals,
  onOpenShortcutsHelp,
}: KeyboardShortcutsHandlers) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isEditing = isEditableElement(event.target);

      // 1. Escape: dismiss modals, drawers, or command palette (allowed even while in inputs)
      if (event.key === 'Escape') {
        if (onCloseModals) {
          onCloseModals();
        }
        return;
      }

      // 2. Cmd + K / Ctrl + K: Command Palette (allowed anywhere, prevents browser address search)
      if ((event.metaKey || event.ctrlKey) && (event.key === 'k' || event.key === 'K')) {
        event.preventDefault();
        event.stopPropagation();
        if (onOpenCommandPalette) {
          onOpenCommandPalette();
        }
        return;
      }

      // If user is typing inside an input, textarea or contenteditable, skip generic shortcuts
      if (isEditing) {
        return;
      }

      // 3. Alt + S: Start / Stop Timer
      if (event.altKey && (event.key === 's' || event.key === 'S')) {
        event.preventDefault();
        if (onToggleTimer) {
          onToggleTimer();
        }
        return;
      }

      // 4. Shift + Space: Alternate ergonomical trigger for Start / Stop Timer
      if (event.shiftKey && (event.key === ' ' || event.code === 'Space')) {
        event.preventDefault();
        if (onToggleTimer) {
          onToggleTimer();
        }
        return;
      }

      // 5. ?: Open Shortcuts Cheat Sheet Help (Shift + / on standard US/ABNT keyboards)
      if (event.key === '?' || (event.shiftKey && event.key === '/')) {
        event.preventDefault();
        if (onOpenShortcutsHelp) {
          onOpenShortcutsHelp();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [onToggleTimer, onOpenCommandPalette, onCloseModals, onOpenShortcutsHelp]);
}
