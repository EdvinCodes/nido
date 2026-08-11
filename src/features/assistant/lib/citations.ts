import type { Route } from 'next';
import { ledgerHref } from '@/features/dashboard/lib/ledger-href';

const CITE_RE = /\[([^\]]+)\]\(nido:ledger\?ids=([^)]+)\)/g;

/** Parses assistant markdown links into ledger deep-links. */
export function parseCitationLinks(
  text: string,
  spaceId: string,
): Array<{ label: string; href: Route; start: number; end: number }> {
  const hits: Array<{ label: string; href: Route; start: number; end: number }> = [];
  for (const match of text.matchAll(CITE_RE)) {
    const full = match[0];
    const label = match[1] ?? '';
    const idsRaw = match[2] ?? '';
    if (idsRaw.length === 0 || label.length === 0) continue;
    const start = match.index;
    if (typeof start !== 'number') continue;
    const transactionIds = idsRaw
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    if (!transactionIds.length) continue;
    hits.push({
      label,
      href: ledgerHref({ spaceId, transactionIds }),
      start,
      end: start + full.length,
    });
  }
  return hits;
}

/** Splits text into plain segments and citation chips for rendering. */
export function splitCitationText(
  text: string,
  spaceId: string,
): Array<{ kind: 'text'; value: string } | { kind: 'cite'; label: string; href: Route }> {
  const cites = parseCitationLinks(text, spaceId);
  if (!cites.length) return [{ kind: 'text', value: text }];

  const parts: Array<
    { kind: 'text'; value: string } | { kind: 'cite'; label: string; href: Route }
  > = [];
  let cursor = 0;
  for (const cite of cites) {
    if (cite.start > cursor) {
      parts.push({ kind: 'text', value: text.slice(cursor, cite.start) });
    }
    parts.push({ kind: 'cite', label: cite.label, href: cite.href });
    cursor = cite.end;
  }
  if (cursor < text.length) {
    parts.push({ kind: 'text', value: text.slice(cursor) });
  }
  return parts;
}
