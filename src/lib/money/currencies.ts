/**
 * Currency metadata. The exponent is the number of decimal places in the currency's
 * minor unit: 2 for EUR (cents), 0 for JPY, 3 for TND. Never hardcode a division by 100.
 *
 * Mirrors the `nido.currencies` table. See docs/02-DATA-MODEL.md §1.
 */

export interface CurrencyInfo {
  readonly code: string;
  readonly name: string;
  readonly symbol: string;
  readonly exponent: number;
}

export const CURRENCIES = {
  EUR: { code: 'EUR', name: 'Euro', symbol: '€', exponent: 2 },
  USD: { code: 'USD', name: 'US Dollar', symbol: '$', exponent: 2 },
  GBP: { code: 'GBP', name: 'British Pound', symbol: '£', exponent: 2 },
  CHF: { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', exponent: 2 },
  SEK: { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', exponent: 2 },
  NOK: { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', exponent: 2 },
  DKK: { code: 'DKK', name: 'Danish Krone', symbol: 'kr', exponent: 2 },
  PLN: { code: 'PLN', name: 'Polish Zloty', symbol: 'zł', exponent: 2 },
  CZK: { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč', exponent: 2 },
  HUF: { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft', exponent: 2 },
  RON: { code: 'RON', name: 'Romanian Leu', symbol: 'lei', exponent: 2 },
  BGN: { code: 'BGN', name: 'Bulgarian Lev', symbol: 'лв', exponent: 2 },
  CAD: { code: 'CAD', name: 'Canadian Dollar', symbol: '$', exponent: 2 },
  AUD: { code: 'AUD', name: 'Australian Dollar', symbol: '$', exponent: 2 },
  NZD: { code: 'NZD', name: 'New Zealand Dollar', symbol: '$', exponent: 2 },
  MXN: { code: 'MXN', name: 'Mexican Peso', symbol: '$', exponent: 2 },
  BRL: { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', exponent: 2 },
  ARS: { code: 'ARS', name: 'Argentine Peso', symbol: '$', exponent: 2 },
  CLP: { code: 'CLP', name: 'Chilean Peso', symbol: '$', exponent: 0 },
  COP: { code: 'COP', name: 'Colombian Peso', symbol: '$', exponent: 2 },
  MAD: { code: 'MAD', name: 'Moroccan Dirham', symbol: 'DH', exponent: 2 },
  TRY: { code: 'TRY', name: 'Turkish Lira', symbol: '₺', exponent: 2 },
  JPY: { code: 'JPY', name: 'Japanese Yen', symbol: '¥', exponent: 0 },
  KRW: { code: 'KRW', name: 'South Korean Won', symbol: '₩', exponent: 0 },
  CNY: { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', exponent: 2 },
  INR: { code: 'INR', name: 'Indian Rupee', symbol: '₹', exponent: 2 },
  ZAR: { code: 'ZAR', name: 'South African Rand', symbol: 'R', exponent: 2 },
  ISK: { code: 'ISK', name: 'Icelandic Krona', symbol: 'kr', exponent: 0 },
  TND: { code: 'TND', name: 'Tunisian Dinar', symbol: 'DT', exponent: 3 },
} as const satisfies Record<string, CurrencyInfo>;

export type CurrencyCode = keyof typeof CURRENCIES;

export const DEFAULT_CURRENCY: CurrencyCode = 'EUR';

export function isCurrencyCode(value: string): value is CurrencyCode {
  return Object.hasOwn(CURRENCIES, value);
}

/**
 * Returns the metadata for a currency, defaulting to 2 decimal places for codes we do
 * not know about. An unknown currency must degrade rather than crash a page of amounts.
 */
export function currencyInfo(code: string): CurrencyInfo {
  if (isCurrencyCode(code)) return CURRENCIES[code];
  return { code, name: code, symbol: code, exponent: 2 };
}

export function currencyExponent(code: string): number {
  return currencyInfo(code).exponent;
}

export const CURRENCY_LIST: readonly CurrencyInfo[] = Object.values(CURRENCIES);
