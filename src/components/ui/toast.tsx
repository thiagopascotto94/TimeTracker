import * as React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'success' | 'amber' | 'destructive';
}

interface ToastContextType {
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  const addToast = React.useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none p-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-lg border p-4 shadow-lg backdrop-blur transition-all duration-300 transform translate-y-0',
              toast.variant === 'amber' &&
                'border-amber-400 dark:border-amber-600/80 bg-amber-50 dark:bg-amber-950/90 text-amber-950 dark:text-amber-100 ring-1 ring-amber-400/50',
              toast.variant === 'success' &&
                'border-emerald-200 dark:border-emerald-800/80 bg-emerald-50 dark:bg-emerald-950/90 text-emerald-950 dark:text-emerald-100',
              toast.variant === 'destructive' &&
                'border-red-200 dark:border-red-800/80 bg-red-50 dark:bg-red-950/90 text-red-950 dark:text-red-100',
              (!toast.variant || toast.variant === 'default') &&
                'border-neutral-200 dark:border-neutral-750 bg-white dark:bg-neutral-850 text-neutral-900 dark:text-neutral-100 shadow-md'
            )}
          >
            <div className="mt-0.5 shrink-0">
              {toast.variant === 'amber' && <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
              {toast.variant === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
              {toast.variant === 'destructive' && <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />}
              {(!toast.variant || toast.variant === 'default') && (
                <Info className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
              )}
            </div>
            <div className="flex-1 space-y-1">
              <h4 className="text-sm font-semibold leading-tight">{toast.title}</h4>
              {toast.description && (
                <p className="text-xs opacity-90 leading-relaxed">{toast.description}</p>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
