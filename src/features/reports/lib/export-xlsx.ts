import * as XLSX from 'xlsx';
import type { PeriodSnapshotPayload } from '../types';

function minorMajor(minor: number, currency: string): number {
  const exp =
    currency === 'JPY' || currency === 'KRW' || currency === 'CLP' || currency === 'ISK' ? 0 : 2;
  return minor / 10 ** exp;
}

export function buildReportXlsx(payload: PeriodSnapshotPayload): Uint8Array {
  const book = XLSX.utils.book_new();

  const summary = [
    ['Period from', payload.from],
    ['Period to', payload.to],
    ['Currency', payload.base_currency],
    ['Income', minorMajor(payload.totals.income_minor, payload.base_currency)],
    ['Expenses', minorMajor(payload.totals.expense_minor, payload.base_currency)],
    ['Net', minorMajor(payload.totals.net_minor, payload.base_currency)],
    ['Savings rate', payload.totals.savings_rate ?? '—'],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summary);
  XLSX.utils.book_append_sheet(book, summarySheet, 'Summary');

  const categories = payload.categories.expense.map((c) => ({
    category: c.name,
    total: minorMajor(c.total_minor, payload.base_currency),
    change: minorMajor(c.change_minor, payload.base_currency),
  }));
  const catSheet = XLSX.utils.json_to_sheet(categories);
  catSheet['!freeze'] = { xSplit: 0, ySplit: 1 };
  XLSX.utils.book_append_sheet(book, catSheet, 'Categories');

  const budgets = payload.budgets.map((b) => ({
    name: b.name,
    limit: minorMajor(b.limit_minor, payload.base_currency),
    spent: minorMajor(b.spent_minor, payload.base_currency),
    remaining: minorMajor(b.remaining_minor, payload.base_currency),
  }));
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(budgets), 'Budgets');

  const goals = payload.goals.map((g) => ({
    name: g.name,
    target: minorMajor(g.target_minor, payload.base_currency),
    saved: minorMajor(g.saved_minor, payload.base_currency),
    progress: g.progress,
  }));
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(goals), 'Goals');

  const out = XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new Uint8Array(out);
}
