'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export function SwUpdateToast() {
  const t = useTranslations('pwa');

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const onControllerChange = () => {
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    void navigator.serviceWorker.ready
      .then((registration) => {
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          if (!worker) return;

          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              toast(t('updateTitle'), {
                description: t('updateBody'),
                duration: Infinity,
                action: {
                  label: t('updateAction'),
                  onClick: () => {
                    worker.postMessage({ type: 'SKIP_WAITING' });
                  },
                },
              });
            }
          });
        });
      })
      .catch(() => {
        /* SW unavailable (Playwright, private mode, etc.) */
      });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, [t]);

  return null;
}
