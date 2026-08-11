'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { TransactionView } from '@/features/transactions/types';

type ComposerMode = 'closed' | 'create' | 'edit' | 'scan';

type ComposerState = {
  mode: ComposerMode;
  transactionId: string | null;
  optimisticTransaction: TransactionView | null;
  openCreate: () => void;
  openScanReceipt: () => void;
  openEdit: (transactionId: string) => void;
  close: () => void;
  insertOptimistic: (tx: TransactionView) => void;
  clearOptimistic: () => void;
};

const ComposerContext = createContext<ComposerState | null>(null);

export function TransactionComposerProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ComposerMode>('closed');
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [optimisticTransaction, setOptimisticTransaction] = useState<TransactionView | null>(null);

  const openCreate = useCallback(() => {
    setTransactionId(null);
    setMode('create');
  }, []);

  const openScanReceipt = useCallback(() => {
    setTransactionId(null);
    setMode('scan');
  }, []);

  const openEdit = useCallback((id: string) => {
    setTransactionId(id);
    setMode('edit');
  }, []);

  const close = useCallback(() => {
    setMode('closed');
    setTransactionId(null);
  }, []);

  const insertOptimistic = useCallback((tx: TransactionView) => {
    setOptimisticTransaction(tx);
  }, []);

  const clearOptimistic = useCallback(() => {
    setOptimisticTransaction(null);
  }, []);

  const value = useMemo(
    () => ({
      mode,
      transactionId,
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
