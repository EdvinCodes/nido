import type { ColumnMappingInput } from '@/features/imports/schemas';
import { normalizeMerchant } from './normalize-merchant';
import { parseAmountValue, parseDebitCredit } from './parse-amounts';
import { parseDateValue, type DateFormatHint } from './parse-dates';
import type { MappedRowPreview } from './types';

function cell(row: string[], headers: string[], column: string | null | undefined): string {
  if (!column) return '';
  const idx = headers.indexOf(column);
  return idx >= 0 ? (row[idx] ?? '').trim() : '';
}

export function applyMappingToRows(
  headers: string[],
  rows: string[][],
  mapping: ColumnMappingInput,
  dateFormat: DateFormatHint,
  dateOrder?: 'DMY' | 'MDY',
): MappedRowPreview[] {
  return rows.map((row, rowIndex) => {
    const description =
      cell(row, headers, mapping.description) || cell(row, headers, mapping.merchant);
    const merchantRaw = cell(row, headers, mapping.merchant) || description;
    const merchant = merchantRaw ? normalizeMerchant(merchantRaw) : null;
    const dateRaw = cell(row, headers, mapping.date);
    const bookedOn = dateRaw ? parseDateValue(dateRaw, dateFormat, dateOrder) : null;

    let amountMinor: bigint | null = null;
    let kind: 'expense' | 'income' | null = null;

    const amountRaw = cell(row, headers, mapping.amount);
    if (amountRaw) {
      const parsed = parseAmountValue(amountRaw);
      if (parsed) {
        amountMinor = parsed.amountMinor;
        kind = parsed.kind;
      }
    } else {
      const dc = parseDebitCredit(
        cell(row, headers, mapping.debit),
        cell(row, headers, mapping.credit),
      );
      if (dc) {
        amountMinor = dc.amountMinor;
        kind = dc.kind;
      }
    }

    const externalId = cell(row, headers, mapping.externalId) || null;
    let error: string | null = null;
    if (!bookedOn) error = 'invalid_date';
    else if (amountMinor === null) error = 'invalid_amount';

    return {
      rowIndex,
      bookedOn,
      description: description.slice(0, 200),
      merchant,
      amountMinor,
      kind,
      externalId,
      error,
    };
  });
}
