import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function EmptyState({
  title,
  body,
  action,
  className,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center',
        className,
      )}
    >
      <h2 className="font-display text-3xl tracking-tight text-balance">{title}</h2>
      <p className="max-w-md text-sm text-balance text-muted-foreground">{body}</p>
      {action ? <div className="flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}
