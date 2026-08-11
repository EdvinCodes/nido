export type StatementEncoding = 'utf-8' | 'latin-1' | 'utf-16le' | 'utf-16be';

export type ColumnMapping = {
  date?: string | null;
  description?: string | null;
  merchant?: string | null;
  amount?: string | null;
  debit?: string | null;
  credit?: string | null;
  balance?: string | null;
  externalId?: string | null;
};

export type ParsedStatementRow = {
  rowIndex: number;
  bookedOn: string;
  description: string;
  merchant: string | null;
  amountMinor: bigint;
  kind: 'expense' | 'income';
  externalId: string | null;
  raw: Record<string, string>;
};

export type ParsedStatement = {
  encoding: StatementEncoding;
  delimiter: ',' | ';' | '\t';
  headerRowIndex: number;
  headers: string[];
  rows: string[][];
  dateFormat: 'DMY' | 'YMD' | 'DMY_DASH' | 'DMY_DOT' | 'ambiguous';
  rowCount: number;
};

export type ParseStatementOptions = {
  /** Force date order when file-wide inference is ambiguous. */
  dateOrder?: 'DMY' | 'MDY';
  sheetIndex?: number;
};

export type MappedRowPreview = {
  rowIndex: number;
  bookedOn: string | null;
  description: string;
  merchant: string | null;
  amountMinor: bigint | null;
  kind: 'expense' | 'income' | null;
  externalId: string | null;
  error: string | null;
};
