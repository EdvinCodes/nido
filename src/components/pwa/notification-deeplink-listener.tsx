'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { route } from '@/lib/routes';

/** Handles deep links from push notification clicks via SW postMessage. */
export function NotificationDeepLinkListener() {
  const router = useRouter();

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; link?: string } | undefined;
      if (data?.type === 'NOTIFICATION_CLICK' && data.link) {
        router.push(route(data.link));
      }
    };

    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', onMessage);
    };
  }, [router]);

  return null;
}
