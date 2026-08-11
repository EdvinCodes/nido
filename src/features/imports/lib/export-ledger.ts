import * as XLSX from 'xlsx';
import type { TransactionView } from '@/features/transactions/types';
import { formatMoney, money } from '@/lib/money';

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function exportLedgerCsv(rows: TransactionView[]): Uint8Array {
  const headers = [
    'booked_on',
    'kind',
    'description',
    'merchant',
    'amount',
    'currency',
    'category_id',
    'account_id',
    'external_id',
  ];
  const lines = [headers.join(',')];
  for (const tx of rows) {
    lines.push(
      [
        tx.booked_on,
        tx.kind,
        escapeCsv(tx.description),
        escapeCsv(tx.merchant ?? ''),
        formatMoney(money(BigInt(tx.amount_minor), tx.currency)),
        tx.currency,
        tx.category_id ?? '',
        tx.account_id ?? '',
        tx.external_id ?? '',
      ].join(','),
    );
  }
  return new TextEncoder().encode(lines.join('\n'));
}

export function exportLedgerXlsx(rows: TransactionView[]): Uint8Array {
  const data = rows.map((tx) => ({
    booked_on: tx.booked_on,
    kind: tx.kind,
    description: tx.description,
    merchant: tx.merchant ?? '',
    amount: formatMoney(money(BigInt(tx.amount_minor), tx.currency)),
    currency: tx.currency,
    category_id: tx.category_id ?? '',
    account_id: tx.account_id ?? '',
    external_id: tx.external_id ?? '',
  }));
  const sheet = XLSX.utils.json_to_sheet(data);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Ledger');
  const out = XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new Uint8Array(out);
}
