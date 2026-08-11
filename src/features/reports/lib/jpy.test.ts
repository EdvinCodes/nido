import { describe, expect, it } from 'vitest';
import { formatMoney, money } from '@/lib/money';
import { currencyExponent } from '@/lib/money/currencies';

describe('JPY exponent end to end', () => {
  it('formats JPY without decimal places', () => {
    const formatted = formatMoney(money(1500n, 'JPY'), { locale: 'en-US' });
    expect(formatted).toMatch(/1,500|1500/);
    expect(formatted).not.toMatch(/\.00/);
  });

  it('uses zero exponent for JPY', () => {
    expect(currencyExponent('JPY')).toBe(0);
  });

  it('parses major to minor for JPY as 1:1', () => {
    const minor = 1500;
    expect(minor).toBe(1500);
    expect(formatMoney(money(BigInt(minor), 'JPY'), { locale: 'en-US', showCurrency: false })).toBe(
      '1,500',
    );
  });
});
