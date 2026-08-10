import { notFound } from 'next/navigation';
import { getSpaceForMember } from '@/features/spaces/queries';
import { SubscriptionDetailClient } from '@/features/subscriptions/subscription-detail-client';
import { getSubscriptionDetail } from '@/features/subscriptions/queries';

export default async function SubscriptionDetailPage({
  params,
}: {
  params: Promise<{ spaceId: string; ruleId: string }>;
}) {
  const { spaceId, ruleId } = await params;
  const membership = await getSpaceForMember(spaceId);
  if (!membership) notFound();

  const detail = await getSubscriptionDetail(spaceId, ruleId);
  if (!detail) notFound();

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <SubscriptionDetailClient spaceId={spaceId} role={membership.role} detail={detail} />
    </main>
  );
}
