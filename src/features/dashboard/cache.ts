import { revalidateTag } from 'next/cache';

export function dashboardCacheTag(spaceId: string): string {
  return `dashboard:${spaceId}`;
}

/** Invalidate every cached summary/series for a space after ledger writes. */
export function invalidateDashboardCache(spaceId: string): void {
  revalidateTag(dashboardCacheTag(spaceId), 'max');
}
