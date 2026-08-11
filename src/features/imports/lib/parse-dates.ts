export type DateFormatHint = 'DMY' | 'YMD' | 'DMY_DASH' | 'DMY_DOT' | 'ambiguous';

type ParsedDateParts = { year: number; month: number; day: number };

function valid(parts: ParsedDateParts): boolean {
  if (parts.month < 1 || parts.month > 12 || parts.day < 1 || parts.day > 31) return false;
  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return (
    d.getUTCFullYear() === parts.year &&
    d.getUTCMonth() === parts.month - 1 &&
    d.getUTCDate() === parts.day
  );
}

function toIso(parts: ParsedDateParts): string {
  const mm = String(parts.month).padStart(2, '0');
  const dd = String(parts.day).padStart(2, '0');
  return `${parts.year}-${mm}-${dd}`;
}

export function inferDateFormat(samples: string[]): DateFormatHint {
  let dmy = 0;
  let mdy = 0;
  let ymd = 0;

  for (const raw of samples) {
    const trimmed = raw.trim();
    if (/^\d{4}-\d{1,2}-\d{1,2}/.test(trimmed)) {
      ymd += 1;
      continue;
    }
    const m = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
    if (!m) continue;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a > 12 && b <= 12) dmy += 1;
    else if (b > 12 && a <= 12) mdy += 1;
    else if (a <= 12 && b <= 12) dmy += 1;
  }

  if (ymd > 0 && dmy === 0 && mdy === 0) return 'YMD';
  if (mdy > dmy && mdy > 0) return 'ambiguous';
  if (dmy >= mdy) return 'DMY';
  return 'ambiguous';
}

export function parseDateValue(
  value: string,
  format: DateFormatHint,
  forcedOrder?: 'DMY' | 'MDY',
): string | null {
  const trimmed = value.trim();

  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(trimmed)) {
    const datePart = trimmed.slice(0, 10);
    const iso = datePart.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (iso) {
      const parts = {
        year: Number(iso[1]),
        month: Number(iso[2]),
        day: Number(iso[3]),
      };
      return valid(parts) ? toIso(parts) : null;
    }
  }

  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const parts = {
      year: Number(iso[1]),
      month: Number(iso[2]),
      day: Number(iso[3]),
    };
    return valid(parts) ? toIso(parts) : null;
  }

  const m = trimmed.match(/^(\d{1,2})([/.-])(\d{1,2})\2(\d{2,4})$/);
  if (!m) return null;

  const a = Number(m[1]);
  const b = Number(m[3]);
  let y = Number(m[4]);
  if (y < 100) y += y >= 70 ? 1900 : 2000;

  let day: number;
  let month: number;
  const order = forcedOrder ?? (format === 'ambiguous' ? undefined : 'DMY');

  if (order === 'MDY') {
    month = a;
    day = b;
  } else if (order === 'DMY') {
    day = a;
    month = b;
  } else if (a > 12) {
    day = a;
    month = b;
  } else if (b > 12) {
    month = a;
    day = b;
  } else {
    return null;
  }

  const parts = { year: y, month, day };
  return valid(parts) ? toIso(parts) : null;
}
