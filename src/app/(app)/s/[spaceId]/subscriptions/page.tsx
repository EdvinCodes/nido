import { notFound } from 'next/navigation';
import { getSpaceForMember } from '@/features/spaces/queries';
import { SubscriptionsListClient } from '@/features/subscriptions/subscriptions-list-client';
import {
  listGhostSubscriptions,
  listRecurringCandidates,
  listSubscriptionCards,
} from '@/features/subscriptions/queries';
import { getActiveParticipants } from '@/features/transactions/queries';

export default async function SubscriptionsPage({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}) {
  const { spaceId } = await params;
  const membership = await getSpaceForMember(spaceId);
  if (!membership) notFound();

  const [cards, candidates, ghosts, participants] = await Promise.all([
    listSubscriptionCards(spaceId),
    listRecurringCandidates(spaceId),
    listGhostSubscriptions(spaceId),
    getActiveParticipants(spaceId),
  ]);

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <SubscriptionsListClient
        spaceId={spaceId}
        role={membership.role}
        currency={membership.space.base_currency}
        active={cards.active}
        cancelled={cards.cancelled}
        monthlyTotalMinor={cards.monthlyTotalMinor}
        annualTotalMinor={cards.annualTotalMinor}
        candidates={candidates}
        ghosts={ghosts}
        participants={participants.map((p) => ({
          id: p.id,
          displayName: p.display_name,
        }))}
      />
    </main>
  );
}
