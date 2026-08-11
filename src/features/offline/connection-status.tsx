'use client';

import { useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

function subscribeOnline(onStoreChange: () => void): () => void {
  window.addEventListener('online', onStoreChange);
  window.addEventListener('offline', onStoreChange);
  return () => {
    window.removeEventListener('online', onStoreChange);
    window.removeEventListener('offline', onStoreChange);
  };
}

function getOnlineSnapshot(): boolean {
  return navigator.onLine;
}

function getOnlineServerSnapshot(): boolean {
  return true;
}

function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getOnlineServerSnapshot);
}

export function ConnectionStatus() {
  const t = useTranslations('pwa');
  const online = useOnline();

  if (online) return null;

  return (
    <div
      role="status"
      className={cn(
        'flex items-center gap-2 border-b border-border bg-warning/10 px-4 py-2 text-xs text-warning-foreground',
      )}
    >
      <WifiOff className="size-3.5 shrink-0" aria-hidden />
      <span>{t('offlineBanner')}</span>
    </div>
  );
}

export function OnlineIndicator({ className }: { className?: string }) {
  const online = useOnline();

  return online ? (
    <Wifi className={cn('size-3.5 text-muted-foreground', className)} aria-hidden />
  ) : (
    <WifiOff className={cn('size-3.5 text-warning', className)} aria-hidden />
  );
}
