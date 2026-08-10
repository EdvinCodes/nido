'use client';

import { cn } from '@/lib/utils';

export function ProgressBar({
  value,
  className,
  label,
}: {
  /** 0–1+; values above 1 fill the track and tint the excess danger. */
  value: number;
  className?: string;
  label?: string;
}) {
  const clamped = Math.max(0, value);
  const fill = Math.min(clamped, 1) * 100;
  const over = clamped > 1;

  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted/40', className)}
      role="progressbar"
      aria-valuenow={Math.round(clamped * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn('h-full rounded-full transition-[width]', over ? 'bg-danger' : 'bg-primary')}
        style={{ width: `${fill}%` }}
      />
    </div>
  );
}
