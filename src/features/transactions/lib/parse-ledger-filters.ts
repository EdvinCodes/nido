import { transactionFiltersSchema, type TransactionFilters } from '../schemas';

type UrlLedgerParams = {
  q?: string | undefined;
  kind?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  tags?: string[] | undefined;
  amountMin?: number | null | undefined;
  amountMax?: number | null | undefined;
  shared?: boolean | undefined;
  mine?: boolean | undefined;
  hasAttachment?: boolean | undefined;
};

/** Maps ledger URL / nuqs state into a validated filter object for list queries. */
export function parseLedgerFilters(
  params: UrlLedgerParams,
  viewerParticipantId?: string,
): TransactionFilters {
  const kind =
    params.kind === 'expense' || params.kind === 'income' || params.kind === 'transfer'
      ? params.kind
      : undefined;

  const tagIds = params.tags?.filter(Boolean);
  const mineOnly = params.mine === true;

  return transactionFiltersSchema.parse({
    search: params.q?.trim() || undefined,
    kind,
    dateFrom: params.from || undefined,
    dateTo: params.to || undefined,
    tagIds: tagIds?.length ? tagIds : undefined,
    amountMin: params.amountMin ?? undefined,
    amountMax: params.amountMax ?? undefined,
    sharedOnly: params.shared === true ? true : undefined,
    mineOnly: mineOnly ? true : undefined,
    hasAttachment: params.hasAttachment === true ? true : undefined,
    viewerParticipantId: mineOnly && viewerParticipantId ? viewerParticipantId : undefined,
  });
}

/** Reads Next.js `searchParams` on the ledger server page. */
export function parseLedgerFiltersFromSearchParams(
  sp: Record<string, string | string[] | undefined>,
  viewerParticipantId?: string,
): TransactionFilters {
  const tagParam = sp.tags;
  const tags =
    typeof tagParam === 'string'
      ? tagParam.split(',').filter(Boolean)
      : Array.isArray(tagParam)
        ? tagParam.filter((t): t is string => typeof t === 'string')
        : [];

  const amountMin = parseMinorParam(sp.min);
  const amountMax = parseMinorParam(sp.max);

  return parseLedgerFilters(
    {
      q: typeof sp.q === 'string' ? sp.q : undefined,
      kind: typeof sp.kind === 'string' ? sp.kind : undefined,
      from: typeof sp.from === 'string' ? sp.from : undefined,
      to: typeof sp.to === 'string' ? sp.to : undefined,
      tags,
      amountMin,
      amountMax,
      shared: sp.shared === '1',
      mine: sp.mine === '1',
      hasAttachment: sp.attached === '1',
    },
    viewerParticipantId,
  );
}

function parseMinorParam(value: string | string[] | undefined): number | null {
  if (typeof value !== 'string' || !value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
