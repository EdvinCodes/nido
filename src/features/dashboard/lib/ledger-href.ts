import type { Route } from 'next';
import { route } from '@/lib/routes';

type LedgerHrefParams = {
  spaceId: string;
  from?: string | undefined;
  to?: string | undefined;
  kind?: 'expense' | 'income' | 'transfer' | undefined;
  categoryId?: string | null | undefined;
  q?: string | undefined;
  transactionIds?: string[] | undefined;
};

/** Deep-link into the ledger, optionally filtered to specific transaction ids. */
export function ledgerHref({
  spaceId,
  from,
  to,
  kind,
  categoryId,
  q,
  transactionIds,
}: LedgerHrefParams): Route {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (kind) params.set('kind', kind);
  if (categoryId) params.set('category', categoryId);
  if (q) params.set('q', q);
  if (transactionIds?.length) params.set('ids', transactionIds.join(','));
  const qs = params.toString();
  return route(`/s/${spaceId}/ledger${qs ? `?${qs}` : ''}`);
}
