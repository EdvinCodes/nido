import { revalidateTag } from 'next/cache';

export function goalsCacheTag(spaceId: string): string {
  return `goals:${spaceId}`;
}

export function invalidateGoalsCache(spaceId: string): void {
  revalidateTag(goalsCacheTag(spaceId), 'max');
}
