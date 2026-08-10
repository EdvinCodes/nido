import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { getSpaceForMember, getUserSpaces } from '@/features/spaces/queries';
import { SpaceProvider } from '@/features/spaces/space-context';
import { createClient } from '@/lib/supabase/server';

export default async function SpaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ spaceId: string }>;
}) {
  const { spaceId } = await params;
  const membership = await getSpaceForMember(spaceId);
  if (!membership) notFound();

  const supabase = await createClient();
  await supabase
    .from('profiles')
    .update({ last_active_space_id: spaceId })
    .eq('id', membership.userId);

  const spaces = await getUserSpaces();

  return (
    <SpaceProvider
      value={{
        space: membership.space,
        role: membership.role,
        participantId: membership.participantId,
        userId: membership.userId,
        spaces,
      }}
    >
      <AppShell
        spaceId={spaceId}
        spaces={spaces}
        role={membership.role}
        spaceName={membership.space.name}
      >
        {children}
      </AppShell>
    </SpaceProvider>
  );
}
