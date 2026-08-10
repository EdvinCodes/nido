export type RecurrenceFreq = 'day' | 'week' | 'month' | 'year';

/** Approximate months per occurrence for annualisation (365.25-day year). */
export function monthlyMinor(amountMinor: number, freq: RecurrenceFreq, intervalCount = 1): number {
  const interval = Math.max(1, intervalCount);
  switch (freq) {
    case 'day':
      return Math.round((amountMinor * 365.25) / (interval * 12));
    case 'week':
      return Math.round((amountMinor * (365.25 / 7)) / (interval * 12));
    case 'month':
      return Math.round(amountMinor / interval);
    case 'year':
      return Math.round(amountMinor / (interval * 12));
    default: {
      const _exhaustive: never = freq;
      return _exhaustive;
    }
  }
}

export function annualMinor(amountMinor: number, freq: RecurrenceFreq, intervalCount = 1): number {
  return monthlyMinor(amountMinor, freq, intervalCount) * 12;
}
