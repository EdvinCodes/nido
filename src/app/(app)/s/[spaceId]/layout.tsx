import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { PwaShortcutHandler } from '@/components/pwa/shortcut-handler';
import { AssistantProvider } from '@/features/assistant/assistant-context';
import { getAiConsent, isConsentActive, listConversations } from '@/features/assistant/queries';
import { isAssistantConfigured } from '@/lib/ai/assistant-enabled';
import { getModelLabel } from '@/lib/ai/providers';
import { isAiConfigured } from '@/lib/ai/is-configured';
import { listAccounts } from '@/features/accounts/queries';
import { ConnectionStatus } from '@/features/offline/connection-status';
import { OfflineProvider } from '@/features/offline/offline-provider';
import { getCategories, getSpaceForMember, getUserSpaces } from '@/features/spaces/queries';
import { SpaceProvider } from '@/features/spaces/space-context';
import { TransactionComposerProvider } from '@/features/transactions/composer-context';
import { getActiveParticipants } from '@/features/transactions/queries';
import { TransactionComposerHost } from '@/features/transactions/transaction-form';
import { getRecentCurrencies } from '@/features/reports/queries';
import { getUnreadNotificationCount, listNotifications } from '@/features/notifications/queries';
import { getPushConfigured, getVapidPublicKey } from '@/features/notifications/server-config';
import { PushPermissionPrompt } from '@/features/notifications/push-permission-card';
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
    assistantConfigured,
    aiConsent,
    conversations,
    recentCurrencies,
    pushConfigured,
    vapidPublicKey,
    budgetCount,
    goalCount,
    subscriptionCount,
  ] = await Promise.all([
    getUserSpaces(),
    getCategories(spaceId),
    listAccounts(spaceId),
    getActiveParticipants(spaceId),
    listNotifications(spaceId),
    getUnreadNotificationCount(spaceId),
    Promise.resolve(isAiConfigured()),
    Promise.resolve(isAssistantConfigured()),
    getAiConsent(spaceId),
    listConversations(spaceId, membership.userId),
    getRecentCurrencies(spaceId),
    Promise.resolve(getPushConfigured()),
    Promise.resolve(getVapidPublicKey()),
    supabase.from('budgets').select('*', { count: 'exact', head: true }).eq('space_id', spaceId),
    supabase.from('goals').select('*', { count: 'exact', head: true }).eq('space_id', spaceId),
    supabase
      .from('recurring_rules')
      .select('*', { count: 'exact', head: true })
      .eq('space_id', spaceId)
      .eq('kind', 'subscription'),
  ]);

  const assistantConsentActive = isConsentActive(aiConsent);
  const assistantNavReady = assistantConfigured && assistantConsentActive;

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
        <OfflineProvider spaceId={spaceId}>
          <ConnectionStatus />
          <AssistantProvider
            spaceId={spaceId}
            consentActive={assistantConsentActive}
            modelLabel={assistantConfigured ? getModelLabel() : null}
            conversations={conversations}
            suggestedContext={{
              hasBudgets: (budgetCount.count ?? 0) > 0,
              hasGoals: (goalCount.count ?? 0) > 0,
              hasSubscriptions: (subscriptionCount.count ?? 0) > 0,
            }}
          >
            <AppShell
              spaceId={spaceId}
              spaces={spaces}
              role={membership.role}
              spaceName={membership.space.name}
              spaceKind={membership.space.kind}
              notifications={notifications}
              unreadCount={unreadCount}
              isAiConfigured={aiReady}
              assistantNavReady={assistantNavReady}
            >
              {children}
            </AppShell>
          </AssistantProvider>
          <Suspense fallback={null}>
            <PwaShortcutHandler />
          </Suspense>
          {pushConfigured ? (
            <PushPermissionPrompt vapidPublicKey={vapidPublicKey} pushConfigured={pushConfigured} />
          ) : null}
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
        </OfflineProvider>
      </TransactionComposerProvider>
    </SpaceProvider>
  );
}
