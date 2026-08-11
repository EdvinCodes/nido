import { notFound } from 'next/navigation';
import { BalancesClient } from '@/features/balances/balances-client';
import { getBalancesPageModel } from '@/features/balances/queries';
import { getSpaceForMember } from '@/features/spaces/queries';
import { createClient } from '@/lib/supabase/server';

export default async function BalancesPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const membership = await getSpaceForMember(spaceId);
  if (!membership) notFound();
  if (membership.space.kind === 'solo') notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const model = await getBalancesPageModel(spaceId, user.id);

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <BalancesClient spaceId={spaceId} role={membership.role} userId={user.id} model={model} />
    </main>
  );
}
