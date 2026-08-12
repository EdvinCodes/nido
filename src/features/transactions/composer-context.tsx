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
import type { TransactionView } from '@/features/transactions/types';

type ComposerMode = 'closed' | 'create' | 'edit' | 'scan';

type ComposerState = {
  mode: ComposerMode;
  transactionId: string | null;
  editTarget: TransactionView | null;
  optimisticTransaction: TransactionView | null;
  openCreate: () => void;
  openScanReceipt: () => void;
  openEdit: (tx: TransactionView) => void;
  close: () => void;
  insertOptimistic: (tx: TransactionView) => void;
  clearOptimistic: () => void;
};

const ComposerContext = createContext<ComposerState | null>(null);

export function TransactionComposerProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ComposerMode>('closed');
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<TransactionView | null>(null);
  const [optimisticTransaction, setOptimisticTransaction] = useState<TransactionView | null>(null);

  const openCreate = useCallback(() => {
    setTransactionId(null);
    setEditTarget(null);
    setMode('create');
  }, []);

  const openScanReceipt = useCallback(() => {
    setTransactionId(null);
    setEditTarget(null);
    setMode('scan');
  }, []);

  const openEdit = useCallback((tx: TransactionView) => {
    setTransactionId(tx.id);
    setEditTarget(tx);
    setMode('edit');
  }, []);

  const close = useCallback(() => {
    setMode('closed');
    setTransactionId(null);
    setEditTarget(null);
  }, []);

  const insertOptimistic = useCallback((tx: TransactionView) => {
    setOptimisticTransaction(tx);
  }, []);

  const clearOptimistic = useCallback(() => {
    setOptimisticTransaction(null);
  }, []);

  useEffect(() => {
    const onFlushed = () => {
      clearOptimistic();
    };
    window.addEventListener('nido:offline-flushed', onFlushed);
    return () => {
      window.removeEventListener('nido:offline-flushed', onFlushed);
    };
  }, [clearOptimistic]);

  const value = useMemo(
    () => ({
      mode,
      transactionId,
      editTarget,
      optimisticTransaction,
      openCreate,
      openScanReceipt,
      openEdit,
      close,
      insertOptimistic,
      clearOptimistic,
    }),
    [
      mode,
      transactionId,
      editTarget,
      optimisticTransaction,
      openCreate,
      openScanReceipt,
      openEdit,
      close,
      insertOptimistic,
      clearOptimistic,
    ],
  );

  return <ComposerContext.Provider value={value}>{children}</ComposerContext.Provider>;
}

export function useTransactionComposer(): ComposerState {
  const ctx = useContext(ComposerContext);
  if (!ctx) {
    throw new Error('useTransactionComposer must be used within TransactionComposerProvider');
  }
  return ctx;
}

export function useTransactionComposerOptional(): ComposerState | null {
  return useContext(ComposerContext);
}
