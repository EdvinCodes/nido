'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type ComposerMode = 'closed' | 'create' | 'edit';

type ComposerState = {
  mode: ComposerMode;
  transactionId: string | null;
  openCreate: () => void;
  openEdit: (transactionId: string) => void;
  close: () => void;
};

const ComposerContext = createContext<ComposerState | null>(null);

export function TransactionComposerProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ComposerMode>('closed');
  const [transactionId, setTransactionId] = useState<string | null>(null);

  const openCreate = useCallback(() => {
    setTransactionId(null);
    setMode('create');
  }, []);

  const openEdit = useCallback((id: string) => {
    setTransactionId(id);
    setMode('edit');
  }, []);

  const close = useCallback(() => {
    setMode('closed');
    setTransactionId(null);
  }, []);

  const value = useMemo(
    () => ({ mode, transactionId, openCreate, openEdit, close }),
    [mode, transactionId, openCreate, openEdit, close],
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
