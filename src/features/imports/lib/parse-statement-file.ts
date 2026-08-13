import { decodeBytes } from './detect-encoding';
import { detectDelimiter, parseCsvText, type Delimiter } from './detect-delimiter';
import { detectHeaderRowIndex, guessColumnMapping } from './detect-header';
import { inferDateFormat } from './parse-dates';
import type { ColumnMapping, ParseStatementOptions, ParsedStatement } from './types';

function trimCell(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

export function parseStatementText(text: string, options?: ParseStatementOptions): ParsedStatement {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const delimiter = detectDelimiter(lines);
  const rows = parseCsvText(text, delimiter);
  return buildParsedStatement(rows, delimiter, options);
}

export async function parseStatementBytes(
  bytes: Uint8Array,
  fileName: string,
  options?: ParseStatementOptions,
): Promise<ParsedStatement> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    return parseXlsxBytes(bytes, options);
  }
  const { encoding, text } = decodeBytes(bytes);
  const statement = parseStatementText(text, options);
  return { ...statement, encoding };
}

async function parseXlsxBytes(
  bytes: Uint8Array,
  options?: ParseStatementOptions,
): Promise<ParsedStatement> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(bytes, { type: 'array', cellDates: false });
  const sheetIndex = options?.sheetIndex ?? 0;
  const sheetName = workbook.SheetNames[sheetIndex] ?? workbook.SheetNames[0];
  if (!sheetName) {
    return buildParsedStatement([], ';', options);
  }
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return buildParsedStatement([], ';', options);
  }
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
  });
  const normalized = rows.map((row) => (Array.isArray(row) ? row.map(trimCell) : []));
  return buildParsedStatement(normalized, ';', options);
}

function buildParsedStatement(
  rows: string[][],
  delimiter: Delimiter,
  options?: ParseStatementOptions,
): ParsedStatement {
  const headerRowIndex = detectHeaderRowIndex(rows);
  const headers = (rows[headerRowIndex] ?? []).map(trimCell);
  const dataRows = rows.slice(headerRowIndex + 1).filter((r) => r.some((c) => c.trim().length > 0));

  const dateSamples = dataRows
    .slice(0, 50)
    .map((r) => {
      const mapping = guessColumnMapping(headers);
      const idx = mapping.date ? headers.indexOf(mapping.date) : -1;
      return idx >= 0 ? (r[idx] ?? '') : '';
    })
    .filter(Boolean);

  let dateFormat = inferDateFormat(dateSamples);
  if (dateFormat === 'ambiguous' && options?.dateOrder) {
    dateFormat = 'DMY';
  }

  return {
    encoding: 'utf-8',
    delimiter,
    headerRowIndex,
    headers,
    rows: dataRows,
    dateFormat,
    rowCount: dataRows.length,
  };
}

export { guessColumnMapping };

export type ParseStatementFileResult = ParsedStatement & {
  suggestedMapping: ColumnMapping;
};

/** Entry point: parse CSV/XLSX bytes into structured statement metadata. */
export async function parseStatementFile(
  bytes: Uint8Array,
  fileName: string,
  options?: ParseStatementOptions,
): Promise<ParseStatementFileResult> {
  const parsed = await parseStatementBytes(bytes, fileName, options);
  const suggestedMapping = guessColumnMapping(parsed.headers);
  return { ...parsed, suggestedMapping };
}

export async function listXlsxSheets(bytes: Uint8Array): Promise<string[]> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(bytes, { type: 'array', bookSheets: true });
  return workbook.SheetNames;
}
