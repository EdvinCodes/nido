'use client';

import { Suspense, useEffect } from 'react';
import { useInfiniteTransactions } from '@/features/transactions/hooks';
import type { TransactionsPage } from '@/features/transactions/queries';
import type { TransactionFilters } from '@/features/transactions/schemas';
import { saveOfflineCache } from '@/features/offline/db';

export function OfflineCacheHydrator({
  spaceId,
  periodKey,
  initialPage,
  initialFilters,
  categories,
  accounts,
  participants,
}: {
  spaceId: string;
  periodKey: string;
  initialPage: TransactionsPage;
  initialFilters: TransactionFilters;
  categories: Array<{
    id: string;
    name: string;
    color: string;
    icon: string;
    kind: string;
    parent_id: string | null;
  }>;
  accounts: Array<{ id: string; name: string; currency: string; kind: string }>;
  participants: Array<{ id: string; display_name: string; user_id: string | null }>;
}) {
  const { data } = useInfiniteTransactions({
    spaceId,
    filters: initialFilters,
    initialPage,
  });

  useEffect(() => {
    if (!navigator.onLine) return;
    const rows = data?.pages.flatMap((p) => p.rows) ?? initialPage.rows;
    void saveOfflineCache({
      spaceId,
      periodKey,
      cachedAt: new Date().toISOString(),
      transactions: rows,
      categories,
      accounts,
      participants,
    });
  }, [data, initialPage.rows, spaceId, periodKey, categories, accounts, participants]);

  return null;
}

export function OfflineCacheHydratorBoundary(props: Parameters<typeof OfflineCacheHydrator>[0]) {
  return (
    <Suspense fallback={null}>
      <OfflineCacheHydrator {...props} />
    </Suspense>
  );
}
