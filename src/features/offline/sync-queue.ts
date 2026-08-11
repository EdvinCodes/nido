'use client';

import { createTransaction } from '@/features/transactions/actions';
import {
  listAllPending,
  removePendingTransaction,
  updatePendingTransaction,
} from '@/features/offline/db';
import type { PendingTransaction } from '@/features/offline/db';

let flushing = false;

export async function flushOfflineQueue(): Promise<{ synced: number; failed: number }> {
  if (flushing || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return { synced: 0, failed: 0 };
  }

  flushing = true;
  let synced = 0;
  let failed = 0;

  try {
    const pending = await listAllPending();
    for (const entry of pending) {
      if (entry.status === 'syncing') continue;
      const ok = await syncOne(entry);
      if (ok) synced += 1;
      else failed += 1;
    }
    if (synced > 0 && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('nido:offline-flushed'));
    }
  } catch {
    failed += 1;
  } finally {
    flushing = false;
  }

  return { synced, failed };
}

async function syncOne(entry: PendingTransaction): Promise<boolean> {
  await updatePendingTransaction(entry.clientId, { status: 'syncing' });

  const result = await createTransaction(entry.input);

  if (result.ok) {
    await removePendingTransaction(entry.clientId);
    return true;
  }

  await updatePendingTransaction(entry.clientId, {
    status: 'failed',
    errorMessage: result.error.message,
  });
  return false;
}

export function registerOfflineSyncListeners(onFlushed?: () => void): () => void {
  const flush = () => {
    void flushOfflineQueue().then((r) => {
      if (r.synced > 0) onFlushed?.();
    });
  };

  window.addEventListener('online', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') flush();
  });

  if (
    process.env.NEXT_PUBLIC_DISABLE_SW !== '1' &&
    'serviceWorker' in navigator &&
    'sync' in ServiceWorkerRegistration.prototype
  ) {
    void navigator.serviceWorker.ready.then((reg) => {
      void reg.sync.register('nido-offline-sync').catch(() => {
        /* Background Sync unavailable (Safari) — foreground flush handles it. */
      });
    });
  }

  flush();

  return () => {
    window.removeEventListener('online', flush);
  };
}
