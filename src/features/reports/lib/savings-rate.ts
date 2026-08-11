/**
 * Savings rate: (income − expenses) / income.
 * Returns null when income is zero (show "—", not infinity).
 */
export function computeSavingsRate(incomeMinor: number, expenseMinor: number): number | null {
  if (incomeMinor === 0) return null;
  return (incomeMinor - expenseMinor) / incomeMinor;
}

export function formatSavingsRate(rate: number | null): string {
  if (rate == null) return '—';
  return `${Math.round(rate * 1000) / 10}%`;
}
