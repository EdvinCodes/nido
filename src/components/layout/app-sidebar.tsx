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
import { cn } from '@/lib/utils';

/** Static sidebar navigation for the app shell. Wired to real routes in later phases. */
const NAV_ITEMS = [
  { key: 'dashboard', href: '/demo', icon: LayoutDashboard },
  { key: 'ledger', href: '/demo/ledger', icon: Receipt },
  { key: 'budgets', href: '/demo/budgets', icon: PiggyBank },
  { key: 'goals', href: '/demo/goals', icon: CircleDollarSign },
  { key: 'balances', href: '/demo/balances', icon: Scale },
  { key: 'subscriptions', href: '/demo/subscriptions', icon: Repeat },
  { key: 'reports', href: '/demo/reports', icon: BarChart3 },
  { key: 'assistant', href: '/demo/assistant', icon: Bot },
  { key: 'settings', href: '/demo/settings', icon: Settings },
] as const;

export function AppSidebar({ activePath }: { activePath: string }) {
  const t = useTranslations('nav');
  const tShell = useTranslations('shell');

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
      <div className="border-b border-sidebar-border px-4 py-4">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {tShell('spacePlaceholder')}
        </p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Primary">
        {NAV_ITEMS.map(({ key, href, icon: Icon }) => {
          const active = activePath === href || activePath.startsWith(`${href}/`);
          return (
            <Link
              key={key}
              href={href}
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
