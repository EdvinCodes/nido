import { notFound } from 'next/navigation';
import { BudgetDetailClient } from '@/features/budgets/budget-detail-client';
import { getBudgetDetail } from '@/features/budgets/queries';
import { getSpaceForMember } from '@/features/spaces/queries';

export default async function BudgetDetailPage({
  params,
}: {
  params: Promise<{ spaceId: string; budgetId: string }>;
}) {
  const { spaceId, budgetId } = await params;
  const membership = await getSpaceForMember(spaceId);
  if (!membership) notFound();

  const detail = await getBudgetDetail(spaceId, budgetId);
  if (!detail) notFound();

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <BudgetDetailClient
        spaceId={spaceId}
        card={detail.card}
        periods={detail.periods}
        transactions={detail.transactions}
      />
    </main>
  );
}
