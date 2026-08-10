/**
 * The Money value object.
 *
 * A monetary value is a count of minor units plus the currency it is denominated in.
 * Never a float, never a bare number. Arithmetic between different currencies throws
 * rather than silently producing a meaningless figure.
 *
 * See docs/02-DATA-MODEL.md §1 and docs/07-ADR.md ADR-004.
 */

import { currencyExponent, DEFAULT_CURRENCY } from './currencies';

export interface Money {
  readonly minor: bigint;
  readonly currency: string;
}

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

export function money(minor: bigint | number, currency: string = DEFAULT_CURRENCY): Money {
  if (typeof minor === 'number') {
    if (!Number.isInteger(minor)) {
      throw new MoneyError(`Minor units must be an integer, got ${minor}`);
    }
    return { minor: BigInt(minor), currency };
  }
  return { minor, currency };
}

export function zero(currency: string = DEFAULT_CURRENCY): Money {
  return { minor: 0n, currency };
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new MoneyError(
      `Cannot combine ${a.currency} with ${b.currency}. Convert to a common currency first.`,
    );
  }
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { minor: a.minor + b.minor, currency: a.currency };
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { minor: a.minor - b.minor, currency: a.currency };
}

export function sum(values: readonly Money[], currency: string = DEFAULT_CURRENCY): Money {
  return values.reduce<Money>((acc, value) => add(acc, value), zero(currency));
}

export function negate(value: Money): Money {
  return { minor: -value.minor, currency: value.currency };
}

export function abs(value: Money): Money {
  return { minor: value.minor < 0n ? -value.minor : value.minor, currency: value.currency };
}

/**
 * Multiplies by a rational number, rounding half away from zero.
 * Rationals rather than floats: `multiply(m, 1n, 3n)` is exact where `m * 0.3333` is not.
 */
export function multiply(value: Money, numerator: bigint, denominator = 1n): Money {
  if (denominator === 0n) throw new MoneyError('Cannot divide by zero');
  const scaled = value.minor * numerator;
  const negative = scaled < 0n !== denominator < 0n;
  const absScaled = scaled < 0n ? -scaled : scaled;
  const absDenominator = denominator < 0n ? -denominator : denominator;
  const quotient = absScaled / absDenominator;
  const remainder = absScaled % absDenominator;
  const rounded = remainder * 2n >= absDenominator ? quotient + 1n : quotient;
  return { minor: negative ? -rounded : rounded, currency: value.currency };
}

export function compare(a: Money, b: Money): -1 | 0 | 1 {
  assertSameCurrency(a, b);
  if (a.minor < b.minor) return -1;
  if (a.minor > b.minor) return 1;
  return 0;
}

export function equals(a: Money, b: Money): boolean {
  return a.currency === b.currency && a.minor === b.minor;
}

export function isZero(value: Money): boolean {
  return value.minor === 0n;
}

export function isNegative(value: Money): boolean {
  return value.minor < 0n;
}

export function isPositive(value: Money): boolean {
  return value.minor > 0n;
}

/**
 * Renders the amount as a plain decimal string ("1234.56"), without a currency symbol or
 * any locale grouping. Used as the exact input to Intl formatting and to SQL.
 */
export function toDecimalString(value: Money): string {
  const exponent = currencyExponent(value.currency);
  const negative = value.minor < 0n;
  const digits = (negative ? -value.minor : value.minor).toString();

  if (exponent === 0) return negative ? `-${digits}` : digits;

  const padded = digits.padStart(exponent + 1, '0');
  const whole = padded.slice(0, padded.length - exponent);
  const fraction = padded.slice(padded.length - exponent);
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

/**
 * Builds a Money from an exact decimal string such as "1234.56" or "-12.5".
 * Rejects anything with more decimal places than the currency supports, rather than
 * silently rounding away part of an amount.
 */
export function fromDecimalString(input: string, currency: string = DEFAULT_CURRENCY): Money {
  const trimmed = input.trim();
  const match = /^(-|\+)?(\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (!match) {
    throw new MoneyError(`"${input}" is not a valid decimal amount`);
  }

  const [, sign, wholePart, fractionPart = ''] = match;
  const exponent = currencyExponent(currency);

  if (fractionPart.length > exponent) {
    throw new MoneyError(
      `${currency} supports ${String(exponent)} decimal places, got ${String(fractionPart.length)}`,
    );
  }

  const minor = BigInt((wholePart ?? '0') + fractionPart.padEnd(exponent, '0'));
  return { minor: sign === '-' ? -minor : minor, currency };
}

/**
 * Ratio of two amounts as a float, for progress bars and percentages only.
 * Never use the result to compute another amount.
 */
export function ratio(value: Money, of: Money): number {
  assertSameCurrency(value, of);
  if (of.minor === 0n) return 0;
  return Number(value.minor) / Number(of.minor);
}
