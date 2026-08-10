'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { CommandPalette } from '@/components/layout/command-palette';
import { MobileTabBar } from '@/components/layout/mobile-tab-bar';
import { SpaceSwitcher } from '@/components/layout/space-switcher';
import type { MemberRole } from '@/lib/auth';
import type { getUserSpaces } from '@/features/spaces/queries';
import type { NotificationRow } from '@/features/notifications/queries';
import { NotificationsBell } from '@/features/notifications/notifications-bell';

type SpaceList = Awaited<ReturnType<typeof getUserSpaces>>;

function useIsDesktop(): boolean | null {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => {
      setIsDesktop(mq.matches);
    };
    sync();
    mq.addEventListener('change', sync);
    return () => {
      mq.removeEventListener('change', sync);
    };
  }, []);

  return isDesktop;
}

export function AppShell({
  children,
  spaceId,
  spaces,
  role,
  spaceName,
  notifications,
  unreadCount,
}: {
  children: ReactNode;
  spaceId: string;
  spaces: SpaceList;
  role: MemberRole;
  spaceName: string;
  notifications: NotificationRow[];
  unreadCount: number;
}) {
  const pathname = usePathname();
  const isDesktop = useIsDesktop();
  const bell =
    isDesktop === null ? null : (
      <NotificationsBell
        spaceId={spaceId}
        initialItems={notifications}
        initialUnread={unreadCount}
      />
    );

  return (
    <div className="flex min-h-full flex-1">
      <AppSidebar
        activePath={pathname}
        spaceId={spaceId}
        spaces={spaces}
        role={role}
        spaceName={spaceName}
        headerAction={isDesktop ? bell : null}
      />
      <div className="flex min-h-full flex-1 flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 lg:hidden">
          <SpaceSwitcher spaces={spaces} currentSpaceId={spaceId} />
          {isDesktop === false ? bell : null}
        </div>
        {children}
        <MobileTabBar activePath={pathname} spaceId={spaceId} />
        <CommandPalette spaceId={spaceId} />
      </div>
    </div>
  );
}
