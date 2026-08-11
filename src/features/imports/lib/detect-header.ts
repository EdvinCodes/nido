const HEADER_HINTS = [
  'fecha',
  'date',
  'data',
  'concepto',
  'description',
  'descripcion',
  'descripción',
  'importe',
  'amount',
  'debit',
  'debe',
  'cargo',
  'credit',
  'haber',
  'abono',
  'saldo',
  'balance',
  'merchant',
  'beneficiario',
  'referencia',
];

function scoreHeaderRow(cells: string[]): number {
  const joined = cells.join(' ').toLowerCase();
  let score = 0;
  for (const hint of HEADER_HINTS) {
    if (joined.includes(hint)) score += 2;
  }
  if (cells.filter((c) => c.trim().length > 0).length >= 3) score += 1;
  return score;
}

export function detectHeaderRowIndex(rows: string[][]): number {
  let bestIndex = 0;
  let bestScore = -1;
  const limit = Math.min(rows.length, 15);
  for (let i = 0; i < limit; i++) {
    const row = rows[i];
    if (!row || row.every((c) => c.trim() === '')) continue;
    const score = scoreHeaderRow(row);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  return bestIndex;
}

export function guessColumnMapping(headers: string[]): Record<string, string | null> {
  const normalized = headers.map((h) => h.toLowerCase().trim());
  const find = (...needles: string[]) => {
    const idx = normalized.findIndex((h) => needles.some((n) => h.includes(n)));
    return idx >= 0 ? headers[idx] : null;
  };

  return {
    date: find('fecha', 'date', 'data', 'booking') ?? null,
    description:
      find('concepto', 'description', 'descripcion', 'descripción', 'detalle', 'memo') ?? null,
    merchant: find('merchant', 'comercio', 'beneficiario', 'establecimiento') ?? null,
    amount: find('importe', 'amount', 'monto') ?? null,
    debit: find('debe', 'debit', 'cargo', 'debito', 'débito') ?? null,
    credit: find('haber', 'credit', 'abono', 'crédito', 'credito') ?? null,
    balance: find('saldo', 'balance') ?? null,
    externalId: find('referencia', 'reference', 'id', 'operation') ?? null,
  };
}
