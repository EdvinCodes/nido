import { revalidateTag } from 'next/cache';

export function balancesCacheTag(spaceId: string): string {
  return `balances:${spaceId}`;
}

export function invalidateBalancesCache(spaceId: string): void {
  revalidateTag(balancesCacheTag(spaceId), 'max');
}
