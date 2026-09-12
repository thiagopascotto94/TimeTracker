import * as React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'amber' | 'indigo';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default:
      'border-transparent bg-neutral-900 dark:bg-neutral-100 text-neutral-50 dark:text-neutral-900 shadow',
    secondary:
      'border-transparent bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700',
    destructive:
      'border-transparent bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border dark:border-red-800/50',
    outline: 'text-neutral-950 dark:text-neutral-200 border-neutral-200 dark:border-neutral-750',
    success:
      'border-transparent bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border dark:border-emerald-800/50',
    amber:
      'border-transparent bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 font-semibold border dark:border-amber-800/50',
    indigo:
      'border-transparent bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 font-semibold border dark:border-indigo-800/50',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:ring-offset-2',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
