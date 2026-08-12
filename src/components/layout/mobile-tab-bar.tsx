'use client';

import {
  Flag,
  LayoutDashboard,
  MoreHorizontal,
  PiggyBank,
  Plus,
  Receipt,
  Repeat,
  Scale,
  Settings,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useTransactionComposerOptional } from '@/features/transactions/composer-context';
import { cn } from '@/lib/utils';
import { route } from '@/lib/routes';
import { ScrollHide, useScrollDirection } from '@/lib/use-scroll-direction';

const LONG_PRESS_MS = 480;

export function MobileTabBar({
  activePath,
  spaceId,
  spaceKind,
  isAiConfigured = false,
}: {
  activePath: string;
  spaceId: string;
  spaceKind: string;
  isAiConfigured?: boolean;
}) {
  const t = useTranslations('nav');
  const tAttachments = useTranslations('attachments');
  const base = `/s/${spaceId}`;
  const composer = useTransactionComposerOptional();
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);
  const scrollDirection = useScrollDirection();
  const hideFab = scrollDirection === 'down';
  const [moreOpen, setMoreOpen] = useState(false);

  const tabs = [
    { key: 'dashboard' as const, href: base, icon: LayoutDashboard, primary: false },
    { key: 'ledger' as const, href: `${base}/ledger`, icon: Receipt, primary: false },
    { key: 'add' as const, href: base, icon: Plus, primary: true },
    { key: 'budgets' as const, href: `${base}/budgets`, icon: PiggyBank, primary: false },
    {
      key: 'more' as const,
      href: `${base}/settings/profile`,
      icon: MoreHorizontal,
      primary: false,
    },
  ];

  const moreLinks = [
    { key: 'goals' as const, href: `${base}/goals`, icon: Flag },
    ...(spaceKind !== 'solo'
      ? [{ key: 'balances' as const, href: `${base}/balances`, icon: Scale }]
      : []),
    { key: 'subscriptions' as const, href: `${base}/subscriptions`, icon: Repeat },
    { key: 'reports' as const, href: `${base}/reports`, icon: LayoutDashboard },
    { key: 'settings' as const, href: `${base}/settings/members`, icon: Settings },
    { key: 'profile' as const, href: `${base}/settings/profile`, icon: UserRound },
  ];

  function clearLongPress(): void {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  const moreActive = moreLinks.some(
    (link) => activePath === link.href || activePath.startsWith(`${link.href}/`),
  );

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex items-end justify-around border-t border-border bg-background/95 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden"
        aria-label="Primary"
      >
        {tabs.map(({ key, href, icon: Icon, primary }) => {
          const active =
            key === 'more'
              ? moreActive
              : activePath === href || (href !== base && activePath.startsWith(href));

          if (primary) {
            return (
              <ScrollHide key={key} hidden={hideFab}>
                <button
                  type="button"
                  className="-mt-5 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-float"
                  aria-label={isAiConfigured ? tAttachments('fabLabelWithScan') : t(key)}
                  onPointerDown={() => {
                    didLongPress.current = false;
                    clearLongPress();
                    if (isAiConfigured) {
                      longPressTimer.current = setTimeout(() => {
                        didLongPress.current = true;
                        composer?.openScanReceipt();
                      }, LONG_PRESS_MS);
                    }
                  }}
                  onPointerUp={() => {
                    clearLongPress();
                    if (didLongPress.current) return;
                    composer?.openCreate();
                  }}
                  onPointerLeave={clearLongPress}
                  onPointerCancel={clearLongPress}
                >
                  <Icon className="size-6" aria-hidden />
                </button>
              </ScrollHide>
            );
          }

          if (key === 'more') {
            return (
              <button
                key={key}
                type="button"
                aria-expanded={moreOpen}
                aria-haspopup="dialog"
                className={cn(
                  'flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 px-2 text-xs',
                  active || moreOpen ? 'text-primary' : 'text-muted-foreground',
                )}
                onClick={() => {
                  setMoreOpen(true);
                }}
              >
                <Icon className="size-5" aria-hidden />
                <span>{t(key)}</span>
              </button>
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

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-xl pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <SheetHeader>
            <SheetTitle>{t('more')}</SheetTitle>
          </SheetHeader>
          <ul className="mt-2 grid gap-1">
            {moreLinks.map(({ key, href, icon: Icon }) => {
              const active = activePath === href || activePath.startsWith(`${href}/`);
              return (
                <li key={key}>
                  <Link
                    href={route(href)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-3 text-sm',
                      active ? 'bg-primary/10 text-primary' : 'hover:bg-surface-raised',
                    )}
                    onClick={() => {
                      setMoreOpen(false);
                    }}
                  >
                    <Icon className="size-5 shrink-0" aria-hidden />
                    <span>{t(key)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}
