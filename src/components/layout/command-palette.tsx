'use client';

import { Command } from 'cmdk';
import {
  ArrowLeftRight,
  Camera,
  Flag,
  LayoutDashboard,
  PiggyBank,
  Plus,
  Receipt,
  Scale,
  Settings,
  Wallet,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { searchTransactionsAction } from '@/features/dashboard/actions';
import type { SearchTransactionHit } from '@/features/dashboard/types';
import { useSpaceContext } from '@/features/spaces/space-context';
import { useTransactionComposerOptional } from '@/features/transactions/composer-context';
import { formatMoney, money } from '@/lib/money';
import { route } from '@/lib/routes';

export function CommandPalette({
  spaceId,
  isAiConfigured = false,
}: {
  spaceId: string;
  isAiConfigured?: boolean;
}) {
  const t = useTranslations('commandPalette');
  const tNav = useTranslations('nav');
  const locale = useLocale();
  const router = useRouter();
  const composer = useTransactionComposerOptional();
  const { spaces, space } = useSpaceContext();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchTransactionHit[]>([]);
  const trimmed = query.trim();
  const searchable = open && trimmed.length >= 2;
  const visibleHits = searchable ? hits : [];

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!searchable) return;

    const handle = window.setTimeout(() => {
      void searchTransactionsAction({ spaceId, query: trimmed, limit: 12 }).then((result) => {
        if (result.ok) setHits(result.data);
      });
    }, 200);

    return () => {
      window.clearTimeout(handle);
    };
  }, [searchable, trimmed, spaceId]);

  function go(path: string): void {
    setOpen(false);
    setQuery('');
    setHits([]);
    router.push(route(path));
  }

  if (!open) return null;

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery('');
          setHits([]);
        }
      }}
    >
      <DialogContent className="overflow-hidden p-0 sm:max-w-lg" showCloseButton={false}>
        <DialogTitle className="sr-only">{t('title')}</DialogTitle>
        <Command
          className="flex max-h-[min(80vh,32rem)] flex-col"
          label={t('title')}
          loop
          shouldFilter={visibleHits.length === 0}
        >
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder={t('placeholder')}
            className="h-12 w-full border-b border-border bg-transparent px-4 text-sm outline-none placeholder:text-muted-foreground"
          />
          <Command.List className="max-h-96 overflow-y-auto p-2">
            <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
              {t('empty')}
            </Command.Empty>

            {visibleHits.length > 0 ? (
              <Command.Group heading={t('results')} className="text-xs text-muted-foreground">
                {visibleHits.map((hit) => (
                  <Command.Item
                    key={hit.id}
                    value={`${hit.description} ${hit.merchant ?? ''} ${hit.id}`}
                    onSelect={() => {
                      go(
                        `/s/${spaceId}/ledger?q=${encodeURIComponent(hit.merchant || hit.description)}`,
                      );
                    }}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-sm text-foreground aria-selected:bg-surface-raised"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {hit.merchant || hit.description || t('untitled')}
                      </span>
                      <span className="block text-xs text-muted-foreground">{hit.booked_on}</span>
                    </span>
                    <span className="amount shrink-0 text-sm">
                      {formatMoney(money(hit.base_amount_minor, hit.currency), { locale })}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}

            <Command.Group heading={t('actions')} className="mt-2 text-xs text-muted-foreground">
              <Command.Item
                value={`${t('addExpense')} expense`}
                onSelect={() => {
                  setOpen(false);
                  setQuery('');
                  setHits([]);
                  composer?.openCreate();
                }}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground aria-selected:bg-surface-raised"
              >
                <Plus className="size-4 shrink-0" aria-hidden />
                {t('addExpense')}
              </Command.Item>
              <Command.Item
                value={`${t('addIncome')} income`}
                onSelect={() => {
                  setOpen(false);
                  setQuery('');
                  setHits([]);
                  composer?.openCreate();
                }}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground aria-selected:bg-surface-raised"
              >
                <ArrowLeftRight className="size-4 shrink-0" aria-hidden />
                {t('addIncome')}
              </Command.Item>
              {isAiConfigured ? (
                <Command.Item
                  value={`${t('addFromReceipt')} receipt scan`}
                  onSelect={() => {
                    setOpen(false);
                    setQuery('');
                    setHits([]);
                    composer?.openScanReceipt();
                  }}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground aria-selected:bg-surface-raised"
                >
                  <Camera className="size-4 shrink-0" aria-hidden />
                  {t('addFromReceipt')}
                </Command.Item>
              ) : null}
            </Command.Group>

            <Command.Group heading={t('navigate')} className="mt-2 text-xs text-muted-foreground">
              <Command.Item
                value={tNav('dashboard')}
                onSelect={() => {
                  go(`/s/${spaceId}`);
                }}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground aria-selected:bg-surface-raised"
              >
                <LayoutDashboard className="size-4 shrink-0" aria-hidden />
                {tNav('dashboard')}
              </Command.Item>
              <Command.Item
                value={tNav('ledger')}
                onSelect={() => {
                  go(`/s/${spaceId}/ledger`);
                }}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground aria-selected:bg-surface-raised"
              >
                <Receipt className="size-4 shrink-0" aria-hidden />
                {tNav('ledger')}
              </Command.Item>
              <Command.Item
                value={tNav('receipts')}
                onSelect={() => {
                  go(`/s/${spaceId}/receipts`);
                }}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground aria-selected:bg-surface-raised"
              >
                <Receipt className="size-4 shrink-0" aria-hidden />
                {tNav('receipts')}
              </Command.Item>
              <Command.Item
                value={tNav('budgets')}
                onSelect={() => {
                  go(`/s/${spaceId}/budgets`);
                }}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground aria-selected:bg-surface-raised"
              >
                <PiggyBank className="size-4 shrink-0" aria-hidden />
                {tNav('budgets')}
              </Command.Item>
              <Command.Item
                value={tNav('goals')}
                onSelect={() => {
                  go(`/s/${spaceId}/goals`);
                }}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground aria-selected:bg-surface-raised"
              >
                <Flag className="size-4 shrink-0" aria-hidden />
                {tNav('goals')}
              </Command.Item>
              {space.kind !== 'solo' ? (
                <Command.Item
                  value={tNav('balances')}
                  onSelect={() => {
                    go(`/s/${spaceId}/balances`);
                  }}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground aria-selected:bg-surface-raised"
                >
                  <Scale className="size-4 shrink-0" aria-hidden />
                  {tNav('balances')}
                </Command.Item>
              ) : null}
              <Command.Item
                value={tNav('accounts')}
                onSelect={() => {
                  go(`/s/${spaceId}/settings/accounts`);
                }}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground aria-selected:bg-surface-raised"
              >
                <Wallet className="size-4 shrink-0" aria-hidden />
                {tNav('accounts')}
              </Command.Item>
              <Command.Item
                value={tNav('settings')}
                onSelect={() => {
                  go(`/s/${spaceId}/settings/members`);
                }}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground aria-selected:bg-surface-raised"
              >
                <Settings className="size-4 shrink-0" aria-hidden />
                {tNav('settings')}
              </Command.Item>
            </Command.Group>

            {spaces.length > 1 ? (
              <Command.Group heading={t('spaces')} className="mt-2 text-xs text-muted-foreground">
                {spaces
                  .filter((entry) => entry.space.id !== spaceId)
                  .map((entry) => (
                    <Command.Item
                      key={entry.space.id}
                      value={`${t('switchSpace')} ${entry.space.name}`}
                      onSelect={() => {
                        go(`/s/${entry.space.id}`);
                      }}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground aria-selected:bg-surface-raised"
                    >
                      {entry.space.name}
                    </Command.Item>
                  ))}
              </Command.Group>
            ) : null}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
