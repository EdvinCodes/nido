'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { MobileTabBar } from '@/components/layout/mobile-tab-bar';

/** Authenticated app chrome: sidebar on desktop, tab bar on mobile. */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-full flex-1">
      <AppSidebar activePath={pathname} />
      <div className="flex min-h-full flex-1 flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0">
        {children}
        <MobileTabBar activePath={pathname} />
      </div>
    </div>
  );
}
