/** Shared Recharts styling — design tokens only, never raw hex. */

/** Axis tick labels — must use muted-foreground (text), not muted (surface fill). */
export const chartAxisStyle = {
  fontSize: 12,
  fill: 'var(--color-muted-foreground)',
} as const;

export const chartLegendStyle = {
  fontSize: 12,
  color: 'var(--color-muted-foreground)',
} as const;

export const chartTooltipStyle = {
  background: 'var(--color-surface-raised)',
  border: '1px solid var(--color-border)',
  borderRadius: 10,
  boxShadow: 'var(--shadow-overlay)',
  color: 'var(--color-foreground)',
} as const;

export const chartTooltipLabelStyle = {
  color: 'var(--color-muted-foreground)',
} as const;

export const chartColors = {
  income: 'var(--color-income)',
  expense: 'var(--color-expense)',
  primary: 'var(--color-primary)',
  mutedForeground: 'var(--color-muted-foreground)',
  border: 'var(--color-border)',
  ghost: 'color-mix(in oklch, var(--color-muted-foreground) 35%, transparent)',
} as const;
