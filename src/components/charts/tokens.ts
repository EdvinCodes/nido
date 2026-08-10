/** Shared Recharts styling — design tokens only, never raw hex. */

export const chartAxisStyle = {
  fontSize: 12,
  fill: 'var(--color-muted)',
} as const;

export const chartTooltipStyle = {
  background: 'var(--color-surface-raised)',
  border: '1px solid var(--color-border)',
  borderRadius: 10,
  boxShadow: 'var(--shadow-overlay)',
  color: 'var(--color-foreground)',
} as const;

export const chartColors = {
  income: 'var(--color-income)',
  expense: 'var(--color-expense)',
  primary: 'var(--color-primary)',
  muted: 'var(--color-muted)',
  border: 'var(--color-border)',
  ghost: 'color-mix(in oklch, var(--color-muted) 35%, transparent)',
} as const;
