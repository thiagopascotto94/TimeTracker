import * as React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'amber';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-950 dark:focus-visible:ring-neutral-300 disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none';

    const variants = {
      default:
        'bg-neutral-900 dark:bg-neutral-900 text-white dark:text-neutral-100 border border-transparent dark:border-neutral-700 shadow-sm hover:bg-neutral-800 dark:hover:bg-neutral-850 active:scale-[0.98] font-semibold',
      destructive:
        'bg-red-600 text-white shadow-sm hover:bg-red-700 active:scale-[0.98] font-semibold',
      outline:
        'border-2 border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 active:scale-[0.98] font-semibold',
      secondary:
        'bg-neutral-200 dark:bg-neutral-850 text-neutral-900 dark:text-neutral-100 shadow-xs hover:bg-neutral-300 dark:hover:bg-neutral-800 active:scale-[0.98] font-semibold',
      ghost:
        'text-neutral-900 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-850 font-semibold',
      link: 'text-neutral-900 dark:text-neutral-100 underline-offset-4 hover:underline font-semibold',
      amber:
        'bg-amber-600 text-white shadow-sm hover:bg-amber-700 active:scale-[0.98] font-semibold',
    };

    const sizes = {
      default: 'h-9 px-4 py-2',
      sm: 'h-8 rounded-md px-3 text-xs',
      lg: 'h-11 rounded-md px-8 text-base',
      icon: 'h-9 w-9',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
