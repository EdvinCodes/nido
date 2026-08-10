import type { Route } from 'next';
import { route } from '@/lib/routes';

type LedgerHrefParams = {
  spaceId: string;
  from?: string | undefined;
  to?: string | undefined;
  kind?: 'expense' | 'income' | 'transfer' | undefined;
  categoryId?: string | null | undefined;
  q?: string | undefined;
};

/** Deep-link into the ledger with filters already applied. */
export function ledgerHref({ spaceId, from, to, kind, categoryId, q }: LedgerHrefParams): Route {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (kind) params.set('kind', kind);
  if (categoryId) params.set('category', categoryId);
  if (q) params.set('q', q);
  const qs = params.toString();
  return route(`/s/${spaceId}/ledger${qs ? `?${qs}` : ''}`);
}
