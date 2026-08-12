import { notFound } from 'next/navigation';
import { BudgetDetailClient } from '@/features/budgets/budget-detail-client';
import { getBudgetDetail } from '@/features/budgets/queries';
import { getCategories, getSpaceForMember } from '@/features/spaces/queries';
import { getActiveParticipants } from '@/features/transactions/queries';

export default async function BudgetDetailPage({
  params,
}: {
  params: Promise<{ spaceId: string; budgetId: string }>;
}) {
  const { spaceId, budgetId } = await params;
  const membership = await getSpaceForMember(spaceId);
  if (!membership) notFound();

  const [detail, categories, participants] = await Promise.all([
    getBudgetDetail(spaceId, budgetId),
    getCategories(spaceId),
    getActiveParticipants(spaceId),
  ]);
  if (!detail) notFound();

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <BudgetDetailClient
        spaceId={spaceId}
        role={membership.role}
        currency={membership.space.base_currency}
        card={detail.card}
        periods={detail.periods}
        transactions={detail.transactions}
        categories={categories
          .filter((c) => c.kind === 'expense' && !c.parent_id)
          .map((c) => ({ id: c.id, name: c.name, color: c.color }))}
        participants={participants.map((p) => ({
          id: p.id,
          displayName: p.display_name,
        }))}
      />
    </main>
  );
}
