import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { isAiConfigured } from '@/lib/ai/is-configured';
import { listAccounts } from '@/features/accounts/queries';
import { getCategories, getSpaceForMember, getUserSpaces } from '@/features/spaces/queries';
import { SpaceProvider } from '@/features/spaces/space-context';
import { TransactionComposerProvider } from '@/features/transactions/composer-context';
import { getActiveParticipants } from '@/features/transactions/queries';
import { TransactionComposerHost } from '@/features/transactions/transaction-form';
import { getRecentCurrencies } from '@/features/reports/queries';
import { getUnreadNotificationCount, listNotifications } from '@/features/notifications/queries';
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

  const [
    spaces,
    categories,
    accounts,
    participants,
    notifications,
    unreadCount,
    aiReady,
    recentCurrencies,
  ] = await Promise.all([
    getUserSpaces(),
    getCategories(spaceId),
    listAccounts(spaceId),
    getActiveParticipants(spaceId),
    listNotifications(spaceId),
    getUnreadNotificationCount(spaceId),
    Promise.resolve(isAiConfigured()),
    getRecentCurrencies(spaceId),
  ]);

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
      <TransactionComposerProvider>
        <AppShell
          spaceId={spaceId}
          spaces={spaces}
          role={membership.role}
          spaceName={membership.space.name}
          spaceKind={membership.space.kind}
          notifications={notifications}
          unreadCount={unreadCount}
          isAiConfigured={aiReady}
        >
          {children}
        </AppShell>
        <TransactionComposerHost
          categories={categories.map((c) => ({
            id: c.id,
            name: c.name,
            color: c.color,
            icon: c.icon,
            kind: c.kind,
            parent_id: c.parent_id,
          }))}
          accounts={accounts}
          participants={participants.map((p) => ({
            id: p.id,
            displayName: p.display_name,
            color: p.color,
            position: p.position,
          }))}
          isAiConfigured={aiReady}
          recentCurrencies={recentCurrencies}
        />
      </TransactionComposerProvider>
    </SpaceProvider>
  );
}
