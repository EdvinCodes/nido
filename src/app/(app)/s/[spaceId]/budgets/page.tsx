import { notFound } from 'next/navigation';
import { BudgetsListClient } from '@/features/budgets/budgets-list-client';
import { getBudgetSuggestions, listBudgetCards } from '@/features/budgets/queries';
import { getCategories, getSpaceForMember } from '@/features/spaces/queries';
import { getActiveParticipants } from '@/features/transactions/queries';

export default async function BudgetsPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const membership = await getSpaceForMember(spaceId);
  if (!membership) notFound();

  const [cards, suggestions, categories, participants] = await Promise.all([
    listBudgetCards(spaceId),
    getBudgetSuggestions(spaceId),
    getCategories(spaceId),
    getActiveParticipants(spaceId),
  ]);

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <BudgetsListClient
        spaceId={spaceId}
        role={membership.role}
        currency={membership.space.base_currency}
        cards={cards}
        suggestions={suggestions}
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
