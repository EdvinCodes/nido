export type Delimiter = ',' | ';' | '\t';

function countDelimiter(line: string, delimiter: string): number {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && ch === delimiter) count += 1;
  }
  return count;
}

export function detectDelimiter(lines: string[]): Delimiter {
  const candidates: Delimiter[] = [';', ',', '\t'];
  const sample = lines
    .slice(0, Math.min(40, lines.length))
    .filter((l) => l.trim().length > 0 && /[;,]|\t/.test(l));
  if (sample.length === 0) return ';';

  let best: Delimiter = ';';
  let bestScore = -1;
  for (const d of candidates) {
    const counts = sample.map((l) => countDelimiter(l, d));
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance =
      counts.reduce((sum, c) => sum + (c - avg) ** 2, 0) / Math.max(counts.length, 1);
    const score = avg - variance;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

export function splitCsvLine(line: string, delimiter: Delimiter): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && ch === delimiter) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch ?? '';
  }
  out.push(cur.trim());
  return out;
}

export function parseCsvText(text: string, delimiter: Delimiter): string[][] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  return lines.map((line) => (line.length === 0 ? [] : splitCsvLine(line, delimiter)));
}
