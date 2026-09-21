import React from 'react';
import {
  Keyboard,
  Clock,
  Command,
  X,
  FileText,
  Search,
  Sparkles,
} from 'lucide-react';
import { Dialog } from './ui/dialog';
import { Button } from './ui/button';

interface ShortcutsHelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShortcutsHelpModal({ open, onOpenChange }: ShortcutsHelpModalProps) {
  const shortcuts = [
    {
      combo: ['Alt', 'S'],
      alternate: ['Shift', 'Espaço'],
      description: 'Iniciar ou Finalizar sessão do Cronômetro',
      category: 'Cronômetro',
      icon: Clock,
    },
    {
      combo: ['Ctrl', 'K'],
      alternate: ['⌘', 'K'],
      description: 'Abrir Paleta de Comandos e busca rápida',
      category: 'Navegação',
      icon: Command,
    },
    {
      combo: ['Esc'],
      description: 'Fechar modais abertos, paleta e gavetas',
      category: 'Geral',
      icon: X,
    },
    {
      combo: ['?'],
      alternate: ['Shift', '/'],
      description: 'Abrir este guia de atalhos de teclado',
      category: 'Ajuda',
      icon: Keyboard,
    },
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Atalhos de Teclado"
      description="Agilize o uso do Cronos utilizando comandos rápidos sem retirar as mãos do teclado."
    >
      <div className="space-y-4 pt-2">
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-100 dark:divide-neutral-800/60 overflow-hidden">
          {shortcuts.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-white dark:bg-neutral-900/60 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                      {item.description}
                    </div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      {item.category}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 pl-2">
                  <div className="flex items-center gap-1">
                    {item.combo.map((key, kIdx) => (
                      <kbd
                        key={kIdx}
                        className="px-2 py-1 text-2xs font-mono font-semibold rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700 shadow-2xs"
                      >
                        {key}
                      </kbd>
                    ))}
                  </div>

                  {item.alternate && (
                    <>
                      <span className="text-2xs text-neutral-400 font-medium">ou</span>
                      <div className="flex items-center gap-1">
                        {item.alternate.map((key, kIdx) => (
                          <kbd
                            key={kIdx}
                            className="px-2 py-1 text-2xs font-mono font-semibold rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700 shadow-2xs"
                          >
                            {key}
                          </kbd>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-2xs text-neutral-500 dark:text-neutral-400 pt-1">
          <span>* Atalhos não interferem enquanto você digita em formulários.</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-7 text-xs"
          >
            Entendido
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
