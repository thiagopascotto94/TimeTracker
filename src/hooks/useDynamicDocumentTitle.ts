import { useEffect, useRef } from 'react';
import { TimeSession } from '../types';
import { calculateElapsedMs, formatTimeHHMMSS } from '../utils/format';

const DEFAULT_TITLE = 'Cronos - Gerenciador Inteligente de Tempo e Produtividade';

interface UseDynamicDocumentTitleOptions {
  activeSession: TimeSession | null;
  clientName?: string | null;
}

/**
 * Updates document.title in real-time with running timer and client name (Etapa 01).
 * Resilient to browser background tab throttling.
 */
export function useDynamicDocumentTitle({
  activeSession,
  clientName,
}: UseDynamicDocumentTitleOptions) {
  const previousTitleRef = useRef<string>(DEFAULT_TITLE);

  useEffect(() => {
    // If no active session or session has ended, restore default title
    if (!activeSession || !activeSession.start_time || activeSession.end_time) {
      document.title = DEFAULT_TITLE;
      return;
    }

    const label = clientName || activeSession.title || 'Sem Cliente';

    const updateTitle = () => {
      const elapsed = calculateElapsedMs(activeSession.start_time);
      const timeStr = formatTimeHHMMSS(elapsed);
      document.title = `⏱️ ${timeStr} - ${label} | Cronos`;
    };

    // Immediate first update
    updateTitle();

    // 1-second interval update for background tabs
    const intervalId = setInterval(updateTitle, 1000);

    // Immediate update on tab visibility change to avoid out-of-sync throttled states
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateTitle();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.title = DEFAULT_TITLE;
    };
  }, [activeSession?.id, activeSession?.start_time, activeSession?.end_time, activeSession?.title, clientName]);
}
