import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: DialogProps) {
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-950/40 backdrop-blur-xs transition-opacity animate-in fade-in p-0 sm:p-6 sm:flex sm:items-center sm:justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 -z-10"
        onClick={() => onOpenChange(false)}
      />
      {/* Content */}
      <div
        className={cn(
          'relative z-50 w-full max-w-lg min-h-full sm:min-h-0 rounded-none sm:rounded-xl border-0 sm:border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-950 dark:text-neutral-50 p-4 sm:p-6 shadow-xl animate-in zoom-in-95 duration-200 flex flex-col',
          className
        )}
      >
        <div className="flex items-start justify-between pb-4 shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{title}</h3>
            {description && (
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">{description}</p>
            )}
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="w-full flex-1 flex flex-col">
          {children}
        </div>
      </div>
    </div>
  );
}
