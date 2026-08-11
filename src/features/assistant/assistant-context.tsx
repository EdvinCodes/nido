'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { AssistantPanel } from '@/features/assistant/assistant-panel';
import type { AiConversationRow } from '@/features/assistant/queries';

type AssistantContextValue = {
  open: boolean;
  toggle: () => void;
  openPanel: () => void;
  closePanel: () => void;
};

const AssistantContext = createContext<AssistantContextValue | null>(null);

export function AssistantProvider({
  children,
  spaceId,
  consentActive,
  modelLabel,
  conversations,
  suggestedContext,
}: {
  children: ReactNode;
  spaceId: string;
  consentActive: boolean;
  modelLabel: string | null;
  conversations: AiConversationRow[];
  suggestedContext: { hasBudgets: boolean; hasGoals: boolean; hasSubscriptions: boolean };
}) {
  const [open, setOpen] = useState(false);

  const value = useMemo<AssistantContextValue>(
    () => ({
      open,
      toggle: () => {
        setOpen((v) => !v);
      },
      openPanel: () => {
        setOpen(true);
      },
      closePanel: () => {
        setOpen(false);
      },
    }),
    [open],
  );

  return (
    <AssistantContext.Provider value={value}>
      {children}
      {consentActive ? (
        <AssistantPanel
          open={open}
          onOpenChange={setOpen}
          spaceId={spaceId}
          consentActive={consentActive}
          modelLabel={modelLabel}
          conversations={conversations}
          suggestedContext={suggestedContext}
        />
      ) : null}
    </AssistantContext.Provider>
  );
}

export function useAssistantPanel(): AssistantContextValue {
  const ctx = useContext(AssistantContext);
  if (!ctx) {
    return {
      open: false,
      toggle: () => {},
      openPanel: () => {},
      closePanel: () => {},
    };
  }
  return ctx;
}

export function useAssistantPanelOptional(): AssistantContextValue | null {
  return useContext(AssistantContext);
}
