'use client';

import { Command } from 'cmdk';
import { LayoutDashboard, Plus, Receipt, Settings, Wallet } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useTransactionComposerOptional } from '@/features/transactions/composer-context';
import { route } from '@/lib/routes';

export function CommandPalette({ spaceId }: { spaceId: string }) {
  const t = useTranslations('commandPalette');
  const tNav = useTranslations('nav');
  const router = useRouter();
  const composer = useTransactionComposerOptional();
  const [open, setOpen] = useState(false);

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

  function go(path: string): void {
    setOpen(false);
    router.push(route(path));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="overflow-hidden p-0 sm:max-w-lg"
        showCloseButton={false}
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">{t('title')}</DialogTitle>
        <Command className="flex max-h-[min(80vh,28rem)] flex-col" label={t('title')} loop>
          <Command.Input
            placeholder={t('placeholder')}
            className="h-12 w-full border-b border-border bg-transparent px-4 text-sm outline-none placeholder:text-muted-foreground"
          />
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
              {t('empty')}
            </Command.Empty>
            <Command.Group heading={t('actions')} className="text-xs text-muted-foreground">
              <Command.Item
                value={`${t('addTransaction')} add`}
                onSelect={() => {
                  setOpen(false);
                  composer?.openCreate();
                }}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground aria-selected:bg-surface-raised"
              >
                <Plus className="size-4 shrink-0" aria-hidden />
                {t('addTransaction')}
              </Command.Item>
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
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
