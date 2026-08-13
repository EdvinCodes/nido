import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function EmptyState({
  title,
  body,
  action,
  className,
  size = 'default',
}: {
  title: string;
  body: string;
  action?: ReactNode;
  className?: string;
  size?: 'default' | 'compact';
}) {
  const compact = size === 'compact';
  return (
    <div
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-4 text-center',
        compact ? 'px-4 py-8' : 'px-6 py-16',
        className,
      )}
    >
      <h2
        className={cn(
          'tracking-tight text-balance',
          compact ? 'text-lg font-semibold' : 'font-display text-3xl',
        )}
      >
        {title}
      </h2>
      <p
        className={cn(
          'text-balance text-muted-foreground',
          compact ? 'max-w-sm text-sm' : 'max-w-md text-sm',
        )}
      >
        {body}
      </p>
      {action ? <div className="flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}
