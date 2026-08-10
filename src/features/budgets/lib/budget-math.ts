export type BudgetUrgency = 'over' | 'approaching' | 'healthy' | 'idle';

export function spentRatio(spentMinor: number, limitMinor: number): number {
  if (limitMinor <= 0) return 0;
  return spentMinor / limitMinor;
}

export function remainingMinor(spentMinor: number, limitMinor: number): number {
  return limitMinor - spentMinor;
}

export function daysLeftInclusive(endsOn: string, today: string): number {
  const end = Date.parse(`${endsOn}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(end) || Number.isNaN(now)) return 0;
  return Math.max(0, Math.floor((end - now) / 86_400_000) + 1);
}

export function dailyAllowanceMinor(
  remaining: number,
  endsOn: string,
  today: string,
): number | null {
  const days = daysLeftInclusive(endsOn, today);
  if (days <= 0) return null;
  if (remaining <= 0) return 0;
  return Math.floor(remaining / days);
}

export function urgencyFromRatio(ratio: number, spentMinor: number): BudgetUrgency {
  if (spentMinor <= 0) return 'idle';
  if (ratio >= 1) return 'over';
  if (ratio >= 0.8) return 'approaching';
  return 'healthy';
}

const URGENCY_ORDER: Record<BudgetUrgency, number> = {
  over: 0,
  approaching: 1,
  healthy: 2,
  idle: 3,
};

export function compareBudgetUrgency(a: BudgetUrgency, b: BudgetUrgency): number {
  return URGENCY_ORDER[a] - URGENCY_ORDER[b];
}

export function roundSuggestedLimit(medianMinor: number): number {
  const step = medianMinor >= 10_000 ? 1000 : 500;
  return Math.max(500, Math.ceil(medianMinor / step) * step);
}
