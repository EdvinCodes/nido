/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { defaultCache } from '@serwist/turbopack/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { CacheFirst, NetworkFirst, Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const THUMB_CACHE = 'receipt-thumbs';

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST ?? [],
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ request }) => request.mode === 'navigate',
      handler: new NetworkFirst({
        cacheName: 'pages',
        networkTimeoutSeconds: 4,
        plugins: [
          {
            handlerDidError: async () => {
              return (await caches.match('/~offline')) ?? Response.error();
            },
          },
        ],
      }),
    },
    ...defaultCache,
    {
      matcher: ({ url }) => url.pathname.includes('/storage/v1/object/'),
      handler: new CacheFirst({
        cacheName: THUMB_CACHE,
        matchOptions: { ignoreSearch: false },
      }),
    },
  ],
  fallbacks: {
    entries: [
      {
        url: '/~offline',
        matcher({ request }) {
          return request.destination === 'document';
        },
      },
    ],
  },
});

self.addEventListener('push', (event) => {
  const data = (event.data?.json() ?? {}) as {
    title?: string;
    body?: string;
    icon?: string;
    badge?: string;
    link?: string;
    notificationId?: string;
    actions?: Array<{ action: string; title: string }>;
  };

  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Nido', {
      ...(data.body ? { body: data.body } : {}),
      icon: data.icon ?? '/icons/icon-192.png',
      badge: data.badge ?? '/icons/icon-192.png',
      data: { link: data.link, notificationId: data.notificationId },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const payload = event.notification.data as { link?: string } | undefined;
  const link = payload?.link ?? '/';

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clients) {
        if ('focus' in client && client.url.includes(self.location.origin)) {
          await client.focus();
          client.postMessage({ type: 'NOTIFICATION_CLICK', link });
          return;
        }
      }
      await self.clients.openWindow(link);
    })(),
  );
});

serwist.addEventListeners();

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const data = event.data as { type?: string } | undefined;
  if (data?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});
