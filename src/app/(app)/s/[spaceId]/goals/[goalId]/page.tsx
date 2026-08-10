import { notFound } from 'next/navigation';
import { GoalDetailClient } from '@/features/goals/goal-detail-client';
import { getGoalDetail } from '@/features/goals/queries';
import { getSpaceForMember } from '@/features/spaces/queries';
import { getActiveParticipants } from '@/features/transactions/queries';
import { createClient } from '@/lib/supabase/server';

export default async function GoalDetailPage({
  params,
}: {
  params: Promise<{ spaceId: string; goalId: string }>;
}) {
  const { spaceId, goalId } = await params;
  const membership = await getSpaceForMember(spaceId);
  if (!membership) notFound();

  const supabase = await createClient();
  const [detail, participants, { data: accounts }] = await Promise.all([
    getGoalDetail(spaceId, goalId),
    getActiveParticipants(spaceId),
    supabase
      .from('accounts')
      .select('id, name')
      .eq('space_id', spaceId)
      .is('archived_at', null)
      .order('position'),
  ]);

  if (!detail) notFound();

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <GoalDetailClient
        spaceId={spaceId}
        role={membership.role}
        detail={detail}
        participants={participants.map((p) => ({
          id: p.id,
          displayName: p.display_name,
        }))}
        accounts={(accounts ?? []).map((a) => ({ id: a.id, name: a.name }))}
      />
    </main>
  );
}
