import { createClient } from '@/lib/supabase/server';
import { todayIn } from '@/lib/dates/periods';

export async function convertToBase(
  amountMinor: number,
  fromCurrency: string,
  toCurrency: string,
  onDate: string,
): Promise<{ baseMinor: number; rate: number; asOf: string }> {
  if (fromCurrency === toCurrency) {
    return { baseMinor: amountMinor, rate: 1, asOf: onDate };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.schema('nido').rpc('convert', {
    p_amount: amountMinor,
    p_from: fromCurrency,
    p_to: toCurrency,
    p_on: onDate,
  });
  if (error) throw error;
  const row = data as { amount_minor: number; rate: number; as_of: string };
  return {
    baseMinor: row.amount_minor,
    rate: row.rate,
    asOf: row.as_of,
  };
}

export async function getAccountBaseBalances(
  accounts: Array<{ id: string; currency: string }>,
  balances: Record<string, number>,
  baseCurrency: string,
  timeZone: string,
): Promise<Record<string, { baseMinor: number; rate: number; asOf: string }>> {
  const on = todayIn(timeZone);
  const out: Record<string, { baseMinor: number; rate: number; asOf: string }> = {};
  await Promise.all(
    accounts.map(async (account) => {
      const native = balances[account.id] ?? 0;
      out[account.id] = await convertToBase(native, account.currency, baseCurrency, on);
    }),
  );
  return out;
}
