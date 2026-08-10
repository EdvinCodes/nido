'use client';

import { LayoutDashboard, MoreHorizontal, PiggyBank, Plus, Receipt } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

const TAB_ITEMS = [
  { key: 'dashboard', href: '/demo', icon: LayoutDashboard, primary: false },
  { key: 'ledger', href: '/demo/ledger', icon: Receipt, primary: false },
  { key: 'add', href: '/demo/add', icon: Plus, primary: true },
  { key: 'budgets', href: '/demo/budgets', icon: PiggyBank, primary: false },
  { key: 'more', href: '/demo/settings', icon: MoreHorizontal, primary: false },
] as const;

/** Bottom tab bar for mobile viewports. Static shell only — real flows arrive in Phase 02+. */
export function MobileTabBar({ activePath }: { activePath: string }) {
  const t = useTranslations('nav');

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex items-end justify-around border-t border-border bg-background/95 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden"
      aria-label="Primary"
    >
      {TAB_ITEMS.map(({ key, href, icon: Icon, primary }) => {
        const active = activePath === href || activePath.startsWith(`${href}/`);

        if (primary) {
          return (
            <Link
              key={key}
              href={href}
              className="-mt-5 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-float"
              aria-label={t(key)}
            >
              <Icon className="size-6" aria-hidden />
            </Link>
          );
        }

        return (
          <Link
            key={key}
            href={href}
            className={cn(
              'flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 px-2 text-xs',
              active ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <Icon className="size-5" aria-hidden />
            <span>{t(key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
