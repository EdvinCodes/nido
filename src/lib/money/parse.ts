/**
 * Parsing user-typed amounts.
 *
 * A Spanish user types "1.234,56". An English one types "1,234.56". Someone in a hurry
 * types "12,5". All three must produce exactly the right number of cents, and none of
 * them may ever pass through a float.
 */

import { currencyExponent, DEFAULT_CURRENCY } from './currencies';
import { decimalSeparator, groupSeparator } from './format';
import { MoneyError, fromDecimalString, type Money } from './money';

export interface ParseMoneyOptions {
  locale?: string;
  currency?: string;
}

export type ParseResult =
  | { ok: true; value: Money }
  | { ok: false; error: 'empty' | 'invalid' | 'too_many_decimals' };

/**
 * Normalizes a locale-formatted amount into a plain decimal string.
 *
 * The ambiguous case is a single separator with exactly three following digits, such as
 * "1,234": it is a group separator in English and a decimal separator nowhere sane, so we
 * resolve it using the locale rather than guessing.
 */
export function normalizeAmountInput(input: string, locale = 'es-ES'): string {
  const decimal = decimalSeparator(locale);
  const group = groupSeparator(locale);

  let cleaned = input
    .trim()
    .replace(/\s/g, '')
    .replace(/[\u00A0\u202F]/g, '')
    .replace(/[^\d.,\-+]/g, '');

  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  if (hasComma && hasDot) {
    // Whichever appears last is the decimal separator, regardless of locale.
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    const decimalChar = lastComma > lastDot ? ',' : '.';
    const groupChar = decimalChar === ',' ? '.' : ',';
    cleaned = cleaned.split(groupChar).join('');
    cleaned = cleaned.replace(decimalChar, '.');
  } else if (hasComma || hasDot) {
    const separator = hasComma ? ',' : '.';
    const occurrences = cleaned.split(separator).length - 1;
    const afterSeparator = cleaned.slice(cleaned.lastIndexOf(separator) + 1);

    if (occurrences > 1) {
      // Repeated separators can only be grouping: "1.234.567".
      cleaned = cleaned.split(separator).join('');
    } else if (separator === group && afterSeparator.length === 3 && separator !== decimal) {
      cleaned = cleaned.split(separator).join('');
    } else {
      cleaned = cleaned.replace(separator, '.');
    }
  }

  return cleaned;
}

export function parseMoney(input: string, options: ParseMoneyOptions = {}): ParseResult {
  const { locale = 'es-ES', currency = DEFAULT_CURRENCY } = options;

  if (input.trim() === '') return { ok: false, error: 'empty' };

  const normalized = normalizeAmountInput(input, locale);
  if (normalized === '' || normalized === '-' || normalized === '+') {
    return { ok: false, error: 'invalid' };
  }

  const exponent = currencyExponent(currency);
  const [, fraction = ''] = normalized.split('.');
  if (fraction.length > exponent) {
    return { ok: false, error: 'too_many_decimals' };
  }

  try {
    return { ok: true, value: fromDecimalString(normalized, currency) };
  } catch (error) {
    if (error instanceof MoneyError) return { ok: false, error: 'invalid' };
    throw error;
  }
}

/** Throwing variant, for trusted input such as seeds and fixtures. */
export function parseMoneyOrThrow(input: string, options: ParseMoneyOptions = {}): Money {
  const result = parseMoney(input, options);
  if (!result.ok) throw new MoneyError(`Cannot parse "${input}" as an amount (${result.error})`);
  return result.value;
}
