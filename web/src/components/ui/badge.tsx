import * as React from 'react';

import { cn } from '../../lib/utils';

type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'scheduled'
  | 'attended'
  | 'canceled'
  | 'no_show';

const variantClasses: Record<BadgeVariant, string> = {
  default:
    'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
  secondary:
    'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
  destructive:
    'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
  outline: 'text-foreground',
  scheduled:
    'border-transparent bg-[var(--color-primary)]/25 text-[var(--color-primary)]',
  attended: 'border-transparent bg-emerald-500/20 text-emerald-400',
  canceled:
    'border-transparent bg-[var(--color-error)]/25 text-[var(--color-error)]',
  no_show: 'border-transparent bg-amber-500/20 text-amber-400',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
