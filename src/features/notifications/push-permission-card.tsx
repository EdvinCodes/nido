'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { removePushSubscription, savePushSubscription } from './actions';

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalonePwa(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

function readPushSupport(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return 'unsupported';
  return Notification.permission;
}

export function PushPermissionCard({
  vapidPublicKey,
  pushConfigured,
}: {
  spaceId: string;
  vapidPublicKey: string | null;
  pushConfigured: boolean;
}) {
  const t = useTranslations('notifications');
  const [permission, setPermission] = useState(readPushSupport);
  const iosNeedsInstall = isIos() && !isStandalonePwa();

  async function subscribe(): Promise<void> {
    if (!vapidPublicKey || !pushConfigured) return;

    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== 'granted') return;

    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const sub =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      }));

    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return;

    await savePushSubscription({
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      userAgent: navigator.userAgent,
    });
  }

  async function unsubscribe(): Promise<void> {
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    if (sub) {
      await removePushSubscription({ endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
    setPermission(Notification.permission);
  }

  if (permission === 'unsupported' || !pushConfigured) {
    return (
      <section className="rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
        {t('pushUnavailable')}
      </section>
    );
  }

  if (iosNeedsInstall) {
    return (
      <section className="rounded-xl border border-border bg-muted/20 p-4">
        <h2 className="text-sm font-medium">{t('pushIosTitle')}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t('pushIosBody')}</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border p-4">
      <h2 className="text-sm font-medium">{t('pushTitle')}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{t('pushBody')}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {permission === 'granted' ? (
          <Button type="button" variant="outline" size="sm" onClick={() => void unsubscribe()}>
            {t('pushDisable')}
          </Button>
        ) : (
          <Button type="button" size="sm" onClick={() => void subscribe()}>
            {t('pushEnable')}
          </Button>
        )}
      </div>
    </section>
  );
}

export function PushPermissionPrompt({
  vapidPublicKey,
  pushConfigured,
}: {
  vapidPublicKey: string | null;
  pushConfigured: boolean;
}) {
  const t = useTranslations('notifications');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!pushConfigured || !vapidPublicKey) return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'default') return;
    if (isIos() && !isStandalonePwa()) return;

    const handler = () => {
      setVisible(true);
      window.removeEventListener('nido:budget-alert', handler);
    };
    window.addEventListener('nido:budget-alert', handler);
    return () => {
      window.removeEventListener('nido:budget-alert', handler);
    };
  }, [pushConfigured, vapidPublicKey]);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 rounded-xl border border-border bg-surface-raised p-4 shadow-overlay lg:right-6 lg:bottom-6 lg:left-auto lg:max-w-sm">
      <p className="text-sm font-medium">{t('pushPrePromptTitle')}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t('pushPrePromptBody')}</p>
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setVisible(false);
          }}
        >
          {t('pushPrePromptLater')}
        </Button>
      </div>
    </div>
  );
}
