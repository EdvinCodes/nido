import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { TransactionView } from '@/features/transactions/types';
import type { CreateTransactionInput } from '@/features/transactions/schemas';

export type OfflineCacheSnapshot = {
  spaceId: string;
  periodKey: string;
  cachedAt: string;
  transactions: TransactionView[];
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
};

export type PendingTransaction = {
  clientId: string;
  requestId: string;
  spaceId: string;
  createdAt: string;
  input: CreateTransactionInput;
  optimistic: TransactionView;
  status: 'pending' | 'syncing' | 'failed';
  errorMessage?: string;
};

interface NidoOfflineDb extends DBSchema {
  cache: {
    key: string;
    value: OfflineCacheSnapshot;
  };
  pending: {
    key: string;
    value: PendingTransaction;
  };
}

const DB_NAME = 'nido-offline';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<NidoOfflineDb>> | null = null;

function getDb(): Promise<IDBPDatabase<NidoOfflineDb>> {
  dbPromise ??= openDB<NidoOfflineDb>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore('cache', { keyPath: 'spaceId' });
      db.createObjectStore('pending', { keyPath: 'clientId' });
    },
  });
  return dbPromise;
}

export async function saveOfflineCache(snapshot: OfflineCacheSnapshot): Promise<void> {
  const db = await getDb();
  await db.put('cache', snapshot);
}

export async function getOfflineCache(spaceId: string): Promise<OfflineCacheSnapshot | undefined> {
  const db = await getDb();
  return db.get('cache', spaceId);
}

export async function enqueuePendingTransaction(entry: PendingTransaction): Promise<void> {
  const db = await getDb();
  await db.put('pending', entry);
}

export async function listPendingTransactions(spaceId: string): Promise<PendingTransaction[]> {
  const db = await getDb();
  const all = await db.getAll('pending');
  return all.filter((p) => p.spaceId === spaceId);
}

export async function updatePendingTransaction(
  clientId: string,
  patch: Partial<PendingTransaction>,
): Promise<void> {
  const db = await getDb();
  const existing = await db.get('pending', clientId);
  if (!existing) return;
  await db.put('pending', { ...existing, ...patch });
}

export async function removePendingTransaction(clientId: string): Promise<void> {
  const db = await getDb();
  await db.delete('pending', clientId);
}

export async function listAllPending(): Promise<PendingTransaction[]> {
  const db = await getDb();
  return db.getAll('pending');
}
