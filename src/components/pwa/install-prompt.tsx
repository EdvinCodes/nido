'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SESSION_KEY = 'nido.session_count';
const DISMISS_KEY = 'nido.install_dismissed';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

function readSessionCount(): number {
  if (typeof window === 'undefined') return 0;
  return Number(localStorage.getItem(SESSION_KEY) ?? '0') + 1;
}

function isDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(DISMISS_KEY) === '1';
}

export function InstallPrompt() {
  const t = useTranslations('pwa');
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showAndroid, setShowAndroid] = useState(false);

  const sessionCount = useMemo(() => {
    if (typeof window === 'undefined') return 0;
    const count = readSessionCount();
    localStorage.setItem(SESSION_KEY, String(count));
    return count;
  }, []);

  const iosHint = sessionCount >= 3 && isIos() && !isStandalone() && !isDismissed();
  const visible = showAndroid && !isDismissed();

  useEffect(() => {
    if (isStandalone() || isDismissed()) return;
    if (isIos()) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      if (sessionCount >= 3) setShowAndroid(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
    };
  }, [sessionCount]);

  function dismiss(): void {
    localStorage.setItem(DISMISS_KEY, '1');
    setShowAndroid(false);
  }

  async function install(): Promise<void> {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setShowAndroid(false);
  }

  if (!visible && !iosHint) return null;

  return (
    <div
      role="region"
      aria-label={t('installTitle')}
      className="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 rounded-xl border border-border bg-surface-raised p-4 shadow-overlay lg:right-6 lg:bottom-6 lg:left-auto lg:max-w-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{t('installTitle')}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {iosHint ? t('installIosBody') : t('installBody')}
          </p>
        </div>
        <button
          type="button"
          className="rounded-md p-1 text-muted-foreground hover:text-foreground"
          onClick={dismiss}
          aria-label={t('installDismiss')}
        >
          <X className="size-4" />
        </button>
      </div>
      {!iosHint && deferred ? (
        <Button type="button" size="sm" className="mt-3 w-full" onClick={() => void install()}>
          {t('installAction')}
        </Button>
      ) : null}
    </div>
  );
}
