'use client';

import type { ReactNode } from 'react';
import { InstallPrompt } from '@/components/pwa/install-prompt';
import { NotificationDeepLinkListener } from '@/components/pwa/notification-deeplink-listener';
import { SerwistProvider } from '@/components/pwa/serwist-provider';
import { SwUpdateToast } from '@/components/pwa/sw-update-toast';

const swDisabled = process.env.NEXT_PUBLIC_DISABLE_SW === '1';

export function PwaShell({ children }: { children: ReactNode }) {
  const content = (
    <>
      {children}
      <InstallPrompt />
      {!swDisabled ? <SwUpdateToast /> : null}
      {!swDisabled ? <NotificationDeepLinkListener /> : null}
    </>
  );

  if (swDisabled) {
    return content;
  }

  return <SerwistProvider swUrl="/serwist/sw.js">{content}</SerwistProvider>;
}
