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
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-neutral-950/40 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={() => onOpenChange(false)}
      />
      {/* Content */}
      <div
        className={cn(
          'relative z-50 w-full max-w-lg rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-950 dark:text-neutral-50 p-6 shadow-xl animate-in zoom-in-95 duration-200',
          className
        )}
      >
        <div className="flex items-start justify-between pb-4">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{title}</h3>
            {description && (
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{description}</p>
            )}
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}
