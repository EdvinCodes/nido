'use client';

import { LayoutDashboard, MoreHorizontal, PiggyBank, Plus, Receipt } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { route } from '@/lib/routes';
import { useTransactionComposerOptional } from '@/features/transactions/composer-context';

export function MobileTabBar({ activePath, spaceId }: { activePath: string; spaceId: string }) {
  const t = useTranslations('nav');
  const base = `/s/${spaceId}`;
  const composer = useTransactionComposerOptional();

  const tabs = [
    { key: 'dashboard' as const, href: base, icon: LayoutDashboard, primary: false, ready: true },
    { key: 'ledger' as const, href: `${base}/ledger`, icon: Receipt, primary: false, ready: true },
    { key: 'add' as const, href: base, icon: Plus, primary: true, ready: true },
    {
      key: 'budgets' as const,
      href: `${base}/budgets`,
      icon: PiggyBank,
      primary: false,
      ready: true,
    },
    {
      key: 'more' as const,
      href: `${base}/settings/members`,
      icon: MoreHorizontal,
      primary: false,
      ready: true,
    },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex items-end justify-around border-t border-border bg-background/95 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden"
      aria-label="Primary"
    >
      {tabs.map(({ key, href, icon: Icon, primary, ready }) => {
        const active = activePath === href || (href !== base && activePath.startsWith(href));

        if (primary) {
          return (
            <button
              key={key}
              type="button"
              className="-mt-5 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-float"
              aria-label={t(key)}
              onClick={() => {
                composer?.openCreate();
              }}
            >
              <Icon className="size-6" aria-hidden />
            </button>
          );
        }

        if (!ready) {
          return (
            <span
              key={key}
              className="flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 px-2 text-xs text-muted-foreground"
            >
              <Icon className="size-5" aria-hidden />
              <span>{t(key)}</span>
            </span>
          );
        }

        return (
          <Link
            key={key}
            href={route(href)}
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
