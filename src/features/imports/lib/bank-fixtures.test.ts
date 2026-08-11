import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { applyMappingToRows } from './apply-mapping';
import { parseStatementFile } from './parse-statement-file';
import type { ColumnMapping } from './types';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

type ExpectedFixture = {
  encoding: string;
  delimiter: string;
  headerRowIndex: number;
  dateFormat: string;
  rows: Array<{
    bookedOn: string;
    description: string;
    merchant?: string;
    amountMinor: number;
    kind: 'expense' | 'income';
  }>;
};

const BANKS: Array<{ name: string; mapping: ColumnMapping }> = [
  {
    name: 'bbva',
    mapping: { date: 'Fecha', description: 'Concepto', amount: 'Importe' },
  },
  {
    name: 'santander',
    mapping: { date: 'Fecha operación', description: 'Concepto', amount: 'Importe' },
  },
  {
    name: 'caixabank',
    mapping: { date: 'Data', description: 'Descripció', amount: 'Import' },
  },
  {
    name: 'ing',
    mapping: { date: 'Date', description: 'Description', amount: 'Amount' },
  },
  {
    name: 'revolut',
    mapping: { date: 'Completed Date', description: 'Description', amount: 'Amount' },
  },
  {
    name: 'n26',
    mapping: { date: 'Date', description: 'Payee', amount: 'Amount (EUR)' },
  },
];

describe('bank statement fixtures', () => {
  for (const bank of BANKS) {
    it(`parses ${bank.name} fixture`, () => {
      const csvPath = join(FIXTURES_DIR, `${bank.name}.csv`);
      const expectedPath = join(FIXTURES_DIR, `${bank.name}.expected.json`);
      const bytes = new Uint8Array(readFileSync(csvPath));
      const expected = JSON.parse(readFileSync(expectedPath, 'utf8')) as ExpectedFixture;

      const parsed = parseStatementFile(bytes, `${bank.name}.csv`);
      expect(parsed.encoding).toBe(expected.encoding);
      expect(parsed.delimiter).toBe(expected.delimiter);
      expect(parsed.headerRowIndex).toBe(expected.headerRowIndex);
      expect(parsed.dateFormat).toBe(expected.dateFormat);

      const mappedAll = applyMappingToRows(
        parsed.headers,
        parsed.rows,
        bank.mapping,
        parsed.dateFormat,
      );
      const mapped = mappedAll.filter((r) => !r.error);

      expect(
        mapped.length,
        mappedAll.map((r) => `${r.rowIndex}:${r.error ?? 'ok'}`).join('; '),
      ).toBe(expected.rows.length);

      for (let i = 0; i < expected.rows.length; i++) {
        const exp = expected.rows[i]!;
        const row = mapped[i]!;
        expect(row.bookedOn).toBe(exp.bookedOn);
        expect(row.description).toContain(exp.description.slice(0, 10));
        expect(row.amountMinor).toBe(BigInt(exp.amountMinor));
        expect(row.kind).toBe(exp.kind);
        if (exp.merchant && row.merchant) {
          expect(row.merchant.toLowerCase()).toContain(exp.merchant.split(' ')[0]!.toLowerCase());
        }
      }
    });
  }
});

describe('normalizeMerchant', () => {
  it('strips terminal noise', async () => {
    const { normalizeMerchant } = await import('./normalize-merchant');
    expect(normalizeMerchant('COMPRA TARJ. MERCADONA VALENCIA 123456')).toBe(
      'Compra Tarj. Mercadona Valencia',
    );
  });
});
