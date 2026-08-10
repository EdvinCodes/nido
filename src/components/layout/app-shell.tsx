'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { MobileTabBar } from '@/components/layout/mobile-tab-bar';
import { SpaceSwitcher } from '@/components/layout/space-switcher';
import type { MemberRole } from '@/lib/auth';
import type { getUserSpaces } from '@/features/spaces/queries';

type SpaceList = Awaited<ReturnType<typeof getUserSpaces>>;

export function AppShell({
  children,
  spaceId,
  spaces,
  role,
  spaceName,
}: {
  children: ReactNode;
  spaceId: string;
  spaces: SpaceList;
  role: MemberRole;
  spaceName: string;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-full flex-1">
      <AppSidebar
        activePath={pathname}
        spaceId={spaceId}
        spaces={spaces}
        role={role}
        spaceName={spaceName}
      />
      <div className="flex min-h-full flex-1 flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0">
        <div className="flex items-center border-b border-border px-4 py-3 lg:hidden">
          <SpaceSwitcher spaces={spaces} currentSpaceId={spaceId} />
        </div>
        {children}
        <MobileTabBar activePath={pathname} spaceId={spaceId} />
      </div>
    </div>
  );
}
