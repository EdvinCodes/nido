'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getOfflineCache, listPendingTransactions } from '@/features/offline/db';
import type { OfflineCacheSnapshot, PendingTransaction } from '@/features/offline/db';
import { registerOfflineSyncListeners } from '@/features/offline/sync-queue';
import { transactionsQueryKey } from '@/features/transactions/hooks';

type OfflineContextValue = {
  pending: PendingTransaction[];
  cache: OfflineCacheSnapshot | null;
  refreshPending: () => Promise<void>;
};

const OfflineContext = createContext<OfflineContextValue | null>(null);

export function OfflineProvider({ spaceId, children }: { spaceId: string; children: ReactNode }) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<PendingTransaction[]>([]);
  const [cache, setCache] = useState<OfflineCacheSnapshot | null>(null);

  const refreshPending = useCallback(async () => {
    const [p, c] = await Promise.all([listPendingTransactions(spaceId), getOfflineCache(spaceId)]);
    setPending(p);
    setCache(c ?? null);
  }, [spaceId]);

  useEffect(() => {
    const unregister = registerOfflineSyncListeners(() => {
      void refreshPending();
      void queryClient.invalidateQueries({ queryKey: transactionsQueryKey(spaceId, {}) });
    });

    const timer = window.setTimeout(() => {
      void refreshPending();
    }, 0);

    return () => {
      window.clearTimeout(timer);
      unregister();
    };
  }, [spaceId, refreshPending, queryClient]);

  const value = useMemo(
    () => ({ pending, cache, refreshPending }),
    [pending, cache, refreshPending],
  );

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOffline(): OfflineContextValue {
  const ctx = useContext(OfflineContext);
  if (!ctx) {
    throw new Error('useOffline must be used within OfflineProvider');
  }
  return ctx;
}

export function useOfflineOptional(): OfflineContextValue | null {
  return useContext(OfflineContext);
}
