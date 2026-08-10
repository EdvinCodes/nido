import { notFound } from 'next/navigation';
import { GoalsListClient } from '@/features/goals/goals-list-client';
import { listGoalCards } from '@/features/goals/queries';
import { getSpaceForMember } from '@/features/spaces/queries';
import { createClient } from '@/lib/supabase/server';

export default async function GoalsPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const membership = await getSpaceForMember(spaceId);
  if (!membership) notFound();

  const supabase = await createClient();
  const [cards, { data: accounts }] = await Promise.all([
    listGoalCards(spaceId),
    supabase
      .from('accounts')
      .select('id, name')
      .eq('space_id', spaceId)
      .is('archived_at', null)
      .order('position'),
  ]);

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <GoalsListClient
        spaceId={spaceId}
        role={membership.role}
        currency={membership.space.base_currency}
        cards={cards}
        accounts={(accounts ?? []).map((a) => ({ id: a.id, name: a.name }))}
      />
    </main>
  );
}
