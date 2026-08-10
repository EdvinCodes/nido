'use client';

import { cn } from '@/lib/utils';

export function ProgressRing({
  value,
  size = 72,
  strokeWidth = 6,
  className,
  label,
}: {
  /** 0–1+; values above 1 render the excess in danger. */
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  label?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, value);
  const basePct = Math.min(clamped, 1);
  const overPct = Math.max(0, clamped - 1);
  const baseOffset = circumference * (1 - basePct);
  const overLen = circumference * Math.min(overPct, 1);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn('shrink-0 -rotate-90', className)}
      role="img"
      aria-label={label ?? `${Math.round(clamped * 100)}%`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted/30"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={baseOffset}
        strokeLinecap="round"
        className={cn(clamped > 1 ? 'text-danger' : 'text-primary')}
      />
      {overPct > 0 ? (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={`${overLen} ${circumference - overLen}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          className="text-danger"
        />
      ) : null}
    </svg>
  );
}
