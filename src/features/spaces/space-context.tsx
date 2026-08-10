'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { MemberRole } from '@/lib/auth';
import type { getUserSpaces } from '@/features/spaces/queries';

type SpaceList = Awaited<ReturnType<typeof getUserSpaces>>;

type SpaceContextValue = {
  space: {
    id: string;
    name: string;
    kind: string;
    base_currency: string;
    timezone: string;
  };
  role: MemberRole;
  participantId: string;
  userId: string;
  spaces: SpaceList;
};

const SpaceContext = createContext<SpaceContextValue | null>(null);

export function SpaceProvider({
  value,
  children,
}: {
  value: SpaceContextValue;
  children: ReactNode;
}) {
  return <SpaceContext.Provider value={value}>{children}</SpaceContext.Provider>;
}

export function useSpaceContext(): SpaceContextValue {
  const ctx = useContext(SpaceContext);
  if (!ctx) throw new Error('useSpaceContext must be used within SpaceProvider');
  return ctx;
}
