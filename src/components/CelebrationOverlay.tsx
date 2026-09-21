import React, { useEffect, useState } from 'react';
import { Sparkles, Trophy, CheckCircle2, X } from 'lucide-react';
import { Button } from './ui/button';

interface CelebrationOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  metricLabel?: string;
}

export function CelebrationOverlay({
  isOpen,
  onClose,
  title,
  message,
  metricLabel,
}: CelebrationOverlayProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShow(true);
      const timer = setTimeout(() => {
        // Auto close after 5 seconds if desired, or let user close
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-3xl border border-amber-200 dark:border-amber-900/50 p-6 sm:p-8 shadow-2xl text-center relative overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-emerald-500 to-indigo-600" />
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4 shadow-sm border border-amber-200 dark:border-amber-800">
          <Trophy className="w-8 h-8 animate-bounce" />
        </div>

        <h3 className="text-xl font-extrabold text-neutral-900 dark:text-neutral-100 tracking-tight mb-2 flex items-center justify-center gap-2">
          <span>{title}</span>
          <Sparkles className="w-5 h-5 text-amber-500" />
        </h3>

        <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-6 leading-relaxed">
          {message}
        </p>

        {metricLabel && (
          <div className="py-2.5 px-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 font-bold text-xs mb-6 inline-flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{metricLabel}</span>
          </div>
        )}

        <div>
          <Button
            onClick={onClose}
            className="w-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 font-bold py-2.5 rounded-xl cursor-pointer shadow-xs text-sm"
          >
            Continuar Produtividade
          </Button>
        </div>
      </div>
    </div>
  );
}
