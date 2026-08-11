import type { AnySupabaseClient } from '@/features/transactions/db';
import { formatMoney, money } from '@/lib/money';

export type ToolContext = {
  spaceId: string;
  userId: string;
  baseCurrency: string;
  locale: string;
  supabase: AnySupabaseClient;
  useRealNames: boolean;
};

export type MoneyField = {
  formatted: string;
  minor: number;
  currency: string;
};

export function formatToolMoney(minor: number, currency: string, locale: string): MoneyField {
  return {
    formatted: formatMoney(money(minor, currency), { locale }),
    minor,
    currency,
  };
}

export function compactRow<T extends Record<string, unknown>>(row: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(row).filter(([, value]) => value !== null && value !== undefined),
  ) as Partial<T>;
}
