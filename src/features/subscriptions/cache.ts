import { revalidateTag } from 'next/cache';

export function subscriptionsCacheTag(spaceId: string): string {
  return `subscriptions:${spaceId}`;
}

export function invalidateSubscriptionsCache(spaceId: string): void {
  revalidateTag(subscriptionsCacheTag(spaceId), 'max');
}
