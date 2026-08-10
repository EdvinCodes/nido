'use client';

/**
 * Client-side ledger paging. Wraps `fetchTransactionsPage` in a TanStack infinite query,
 * seeded with the first page rendered on the server so there is no loading flash.
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchTransactionsPage } from './actions';
import type { TransactionFilters, TransactionCursor } from './schemas';
import type { TransactionsPage } from './queries';

export const PAGE_SIZE = 50;

export function transactionsQueryKey(spaceId: string, filters: TransactionFilters) {
  return ['transactions', spaceId, filters] as const;
}

export function useInfiniteTransactions({
  spaceId,
  filters,
  initialPage,
}: {
  spaceId: string;
  filters: TransactionFilters;
  initialPage?: TransactionsPage;
}) {
  return useInfiniteQuery({
    queryKey: transactionsQueryKey(spaceId, filters),
    initialPageParam: null as TransactionCursor | null,
    queryFn: async ({ pageParam }) => {
      const result = await fetchTransactionsPage({
        spaceId,
        filters,
        cursor: pageParam,
        limit: PAGE_SIZE,
      });
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    ...(initialPage
      ? {
          initialData: {
            pages: [initialPage],
            pageParams: [null as TransactionCursor | null],
          },
        }
      : {}),
  });
}
