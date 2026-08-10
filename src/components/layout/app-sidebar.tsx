'use client';

import {
  BarChart3,
  Bot,
  CircleDollarSign,
  LayoutDashboard,
  PiggyBank,
  Receipt,
  Repeat,
  Scale,
  Settings,
} from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { SpaceSwitcher } from '@/components/layout/space-switcher';
import { cn } from '@/lib/utils';
import { route } from '@/lib/routes';
import type { MemberRole } from '@/lib/auth';
import type { getUserSpaces } from '@/features/spaces/queries';

type SpaceList = Awaited<ReturnType<typeof getUserSpaces>>;

const NAV_ITEMS = [
  { key: 'dashboard', href: '', icon: LayoutDashboard, ready: true },
  { key: 'ledger', href: '/ledger', icon: Receipt, ready: true },
  { key: 'budgets', href: '/budgets', icon: PiggyBank, ready: false },
  { key: 'goals', href: '/goals', icon: CircleDollarSign, ready: false },
  { key: 'balances', href: '/balances', icon: Scale, ready: false },
  { key: 'subscriptions', href: '/subscriptions', icon: Repeat, ready: false },
  { key: 'reports', href: '/reports', icon: BarChart3, ready: false },
  { key: 'assistant', href: '/assistant', icon: Bot, ready: false },
  { key: 'settings', href: '/settings/members', icon: Settings, ready: true },
] as const;

export function AppSidebar({
  activePath,
  spaceId,
  spaces,
  spaceName,
}: {
  activePath: string;
  spaceId: string;
  spaces: SpaceList;
  role: MemberRole;
  spaceName: string;
}) {
  const t = useTranslations('nav');
  void spaceName;

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
      <div className="border-b border-sidebar-border px-4 py-4">
        <SpaceSwitcher spaces={spaces} currentSpaceId={spaceId} />
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Primary">
        {NAV_ITEMS.map(({ key, href, icon: Icon, ready }) => {
          const fullHref = `/s/${spaceId}${href}`;
          const active =
            href === '' ? activePath === `/s/${spaceId}` : activePath.startsWith(fullHref);
          if (!ready) {
            return (
              <span
                key={key}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground"
                aria-disabled
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="flex-1">{t(key)}</span>
                <span className="text-[10px] tracking-wide uppercase">{t('comingSoon')}</span>
              </span>
            );
          }
          return (
            <Link
              key={key}
              href={route(fullHref)}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/60',
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {t(key)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
