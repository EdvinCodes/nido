/** Parse bank amount strings into positive minor units and kind. */
export function parseAmountValue(
  raw: string,
  currencyExponent = 2,
): { amountMinor: bigint; kind: 'expense' | 'income' } | null {
  let s = raw.trim();
  if (!s) return null;

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.endsWith('-')) {
    negative = true;
    s = s.slice(0, -1);
  }
  if (s.startsWith('-')) {
    negative = true;
    s = s.slice(1);
  }
  if (s.startsWith('+')) {
    s = s.slice(1);
  }

  s = s.replace(/\s/g, '').replace(/[^\d,.-]/g, '');

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (lastComma >= 0) {
    const decimals = s.length - lastComma - 1;
    if (decimals <= 2) s = s.replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (lastDot >= 0) {
    const decimals = s.length - lastDot - 1;
    if (decimals > 2) s = s.replace(/\./g, '');
  }

  const num = Number(s);
  if (!Number.isFinite(num) || num === 0) return null;

  const factor = 10 ** currencyExponent;
  const minor = BigInt(Math.round(Math.abs(num) * factor));
  const kind = negative || num < 0 ? 'expense' : 'income';
  return { amountMinor: minor, kind };
}

export function parseDebitCredit(
  debitRaw: string,
  creditRaw: string,
  currencyExponent = 2,
): { amountMinor: bigint; kind: 'expense' | 'income' } | null {
  const debit = debitRaw.trim();
  const credit = creditRaw.trim();
  if (debit && !credit) {
    const parsed = parseAmountValue(debit, currencyExponent);
    return parsed ? { amountMinor: parsed.amountMinor, kind: 'expense' } : null;
  }
  if (credit && !debit) {
    const parsed = parseAmountValue(credit, currencyExponent);
    return parsed ? { amountMinor: parsed.amountMinor, kind: 'income' } : null;
  }
  if (debit && credit) {
    const d = parseAmountValue(debit, currencyExponent);
    if (d) return { amountMinor: d.amountMinor, kind: 'expense' };
    const c = parseAmountValue(credit, currencyExponent);
    if (c) return { amountMinor: c.amountMinor, kind: 'income' };
  }
  return null;
}
