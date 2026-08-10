/**
 * Money formatting. The only place a monetary value becomes a string for a human.
 *
 * Formatting goes through Intl with the exact decimal string rather than a JavaScript
 * number, so a large amount can never lose precision on its way to the screen.
 */

import { currencyExponent } from './currencies';
import { toDecimalString, type Money } from './money';

export interface FormatMoneyOptions {
  /** BCP-47 locale. Defaults to Spanish. */
  locale?: string;
  /** Show the currency symbol. Defaults to true. */
  showCurrency?: boolean;
  /** Force an explicit + or − prefix, for deltas. */
  signDisplay?: 'auto' | 'always' | 'never' | 'exceptZero';
  /** Drop the decimals when the amount is a whole unit, for compact cards. */
  hideZeroDecimals?: boolean;
  /** Abbreviate to "1,2 k €". Charts and compact cards only, never the ledger. */
  compact?: boolean;
}

const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(key: string, factory: () => Intl.NumberFormat): Intl.NumberFormat {
  const cached = formatterCache.get(key);
  if (cached) return cached;
  const created = factory();
  formatterCache.set(key, created);
  return created;
}

export function formatMoney(value: Money, options: FormatMoneyOptions = {}): string {
  const {
    locale = 'es-ES',
    showCurrency = true,
    signDisplay = 'auto',
    hideZeroDecimals = false,
    compact = false,
  } = options;

  const exponent = currencyExponent(value.currency);
  const decimals = hideZeroDecimals && value.minor % 10n ** BigInt(exponent) === 0n ? 0 : exponent;

  const key = [
    locale,
    value.currency,
    showCurrency,
    signDisplay,
    decimals,
    compact,
    exponent,
  ].join('|');

  const formatter = getFormatter(key, () =>
    showCurrency
      ? new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: value.currency,
          currencyDisplay: 'narrowSymbol',
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
          // Spanish omits grouping below five digits; a ledger column reads better with it.
          useGrouping: compact ? 'auto' : 'always',
          signDisplay,
          ...(compact ? { notation: 'compact' as const } : {}),
        })
      : new Intl.NumberFormat(locale, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
          useGrouping: compact ? 'auto' : 'always',
          signDisplay,
          ...(compact ? { notation: 'compact' as const } : {}),
        }),
  );

  // Intl.NumberFormat v3 accepts a decimal string, which avoids any float round trip.
  return formatter.format(toDecimalString(value) as unknown as number);
}

/** The em dash used for an unknown amount. Zero and unknown are different things. */
export const EMPTY_AMOUNT = '—';

export function formatMoneyOrDash(
  value: Money | null | undefined,
  options?: FormatMoneyOptions,
): string {
  if (!value) return EMPTY_AMOUNT;
  return formatMoney(value, options);
}

/** Returns the decimal separator for a locale, for driving the amount input. */
export function decimalSeparator(locale: string): string {
  const parts = new Intl.NumberFormat(locale).formatToParts(1.1);
  return parts.find((part) => part.type === 'decimal')?.value ?? '.';
}

/**
 * Returns the group separator for a locale.
 *
 * Probed with a seven-digit number on purpose: Spanish does not group four-digit integers,
 * so `formatToParts(1000)` reports no group part at all and would silently give the wrong
 * separator.
 */
export function groupSeparator(locale: string): string {
  const parts = new Intl.NumberFormat(locale, { useGrouping: 'always' }).formatToParts(1_234_567);
  return parts.find((part) => part.type === 'group')?.value ?? ',';
}

/** Formats a ratio as a percentage. Progress indicators only. */
export function formatPercent(value: number, locale = 'es-ES', maximumFractionDigits = 0): string {
  const formatter = getFormatter(`pct|${locale}|${String(maximumFractionDigits)}`, () =>
    new Intl.NumberFormat(locale, {
      style: 'percent',
      maximumFractionDigits,
    }),
  );
  return formatter.format(value);
}
