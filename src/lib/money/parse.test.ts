import { describe, expect, it } from 'vitest';
import { normalizeAmountInput, parseMoney, parseMoneyOrThrow } from './parse';
import { formatMoney, formatMoneyOrDash, formatPercent, EMPTY_AMOUNT } from './format';
import { money } from './money';

describe('normalizeAmountInput', () => {
  it('handles Spanish formatting', () => {
    expect(normalizeAmountInput('1.234,56', 'es-ES')).toBe('1234.56');
    expect(normalizeAmountInput('12,5', 'es-ES')).toBe('12.5');
    expect(normalizeAmountInput('1.234', 'es-ES')).toBe('1234');
  });

  it('handles English formatting', () => {
    expect(normalizeAmountInput('1,234.56', 'en-US')).toBe('1234.56');
    expect(normalizeAmountInput('12.5', 'en-US')).toBe('12.5');
    expect(normalizeAmountInput('1,234', 'en-US')).toBe('1234');
  });

  it('resolves mixed separators by position, not locale', () => {
    expect(normalizeAmountInput('1.234,56', 'en-US')).toBe('1234.56');
    expect(normalizeAmountInput('1,234.56', 'es-ES')).toBe('1234.56');
  });

  it('treats repeated separators as grouping', () => {
    expect(normalizeAmountInput('1.234.567', 'es-ES')).toBe('1234567');
    expect(normalizeAmountInput('1,234,567', 'en-US')).toBe('1234567');
  });

  it('strips currency symbols and whitespace', () => {
    expect(normalizeAmountInput('  1.234,56 €', 'es-ES')).toBe('1234.56');
    expect(normalizeAmountInput('$1,234.56', 'en-US')).toBe('1234.56');
    expect(normalizeAmountInput('1 234,56', 'es-ES')).toBe('1234.56');
  });
});

describe('parseMoney', () => {
  it('parses common inputs', () => {
    expect(parseMoney('1.234,56', { locale: 'es-ES' })).toEqual({
      ok: true,
      value: money(123_456n, 'EUR'),
    });
    expect(parseMoney('12,5', { locale: 'es-ES' })).toEqual({ ok: true, value: money(1250n) });
    expect(parseMoney('-8', { locale: 'es-ES' })).toEqual({ ok: true, value: money(-800n) });
  });

  it('reports empty and invalid input distinctly', () => {
    expect(parseMoney('')).toEqual({ ok: false, error: 'empty' });
    expect(parseMoney('   ')).toEqual({ ok: false, error: 'empty' });
    expect(parseMoney('abc')).toEqual({ ok: false, error: 'invalid' });
    expect(parseMoney('-')).toEqual({ ok: false, error: 'invalid' });
  });

  it('rejects too many decimals for the currency', () => {
    expect(parseMoney('12,345', { locale: 'es-ES' })).toEqual({
      ok: false,
      error: 'too_many_decimals',
    });
    expect(parseMoney('12,5', { locale: 'es-ES', currency: 'JPY' })).toEqual({
      ok: false,
      error: 'too_many_decimals',
    });
  });

  it('parses zero-decimal currencies', () => {
    expect(parseMoney('1.234', { locale: 'es-ES', currency: 'JPY' })).toEqual({
      ok: true,
      value: money(1234n, 'JPY'),
    });
  });

  it('throws on the strict variant', () => {
    expect(() => parseMoneyOrThrow('nope')).toThrow();
  });
});

describe('formatMoney', () => {
  it('formats in Spanish', () => {
    const result = formatMoney(money(123_456n, 'EUR'), { locale: 'es-ES' });
    expect(result).toContain('1.234,56');
    expect(result).toContain('€');
  });

  it('formats in English', () => {
    const result = formatMoney(money(123_456n, 'USD'), { locale: 'en-US' });
    expect(result).toContain('1,234.56');
    expect(result).toContain('$');
  });

  it('respects the currency exponent', () => {
    expect(formatMoney(money(1234n, 'JPY'), { locale: 'es-ES' })).toContain('1.234');
    expect(formatMoney(money(1234n, 'JPY'), { locale: 'es-ES' })).not.toContain(',');
  });

  it('does not lose precision on very large amounts', () => {
    const result = formatMoney(money(9_007_199_254_740_993_00n, 'EUR'), {
      locale: 'en-US',
      showCurrency: false,
    });
    expect(result).toBe('9,007,199,254,740,993.00');
  });

  it('supports sign display for deltas', () => {
    expect(formatMoney(money(500n), { locale: 'es-ES', signDisplay: 'always' })).toContain('+');
  });

  it('can hide the currency and zero decimals', () => {
    expect(formatMoney(money(1200n), { locale: 'es-ES', showCurrency: false })).toBe('12,00');
    expect(
      formatMoney(money(1200n), { locale: 'es-ES', showCurrency: false, hideZeroDecimals: true }),
    ).toBe('12');
  });

  it('renders an em dash for an unknown amount, not zero', () => {
    expect(formatMoneyOrDash(null)).toBe(EMPTY_AMOUNT);
    expect(formatMoneyOrDash(undefined)).toBe(EMPTY_AMOUNT);
    expect(formatMoneyOrDash(money(0n))).not.toBe(EMPTY_AMOUNT);
  });

  it('formats percentages', () => {
    expect(formatPercent(0.8, 'es-ES')).toContain('80');
  });
});
