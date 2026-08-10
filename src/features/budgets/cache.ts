import { revalidateTag } from 'next/cache';

export function budgetsCacheTag(spaceId: string): string {
  return `budgets:${spaceId}`;
}

export function invalidateBudgetsCache(spaceId: string): void {
  revalidateTag(budgetsCacheTag(spaceId), 'max');
}
