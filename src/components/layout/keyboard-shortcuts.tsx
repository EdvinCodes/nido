'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTransactionComposerOptional } from '@/features/transactions/composer-context';
import { route } from '@/lib/routes';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

type NavShortcut = {
  keys: string;
  path: string;
};

export function KeyboardShortcuts({
  spaceId,
  assistantNavReady = false,
  onToggleAssistant,
}: {
  spaceId: string;
  isAiConfigured?: boolean;
  assistantNavReady?: boolean;
  onToggleAssistant?: (() => void) | undefined;
}) {
  const t = useTranslations('shortcuts');
  const router = useRouter();
  const composer = useTransactionComposerOptional();
  const [helpOpen, setHelpOpen] = useState(false);
  const pendingG = useRef(false);
  const pendingTimer = useRef<number | null>(null);

  const navShortcuts = useMemo<NavShortcut[]>(
    () => [
      { keys: 'g h', path: `/s/${spaceId}` },
      { keys: 'g l', path: `/s/${spaceId}/ledger` },
      { keys: 'g b', path: `/s/${spaceId}/budgets` },
      { keys: 'g g', path: `/s/${spaceId}/goals` },
      { keys: 'g r', path: `/s/${spaceId}/reports` },
      { keys: 'g s', path: `/s/${spaceId}/settings/members` },
    ],
    [spaceId],
  );

  const go = useCallback(
    (path: string) => {
      router.push(route(path));
    },
    [router],
  );

  useEffect(() => {
    function clearPendingG(): void {
      pendingG.current = false;
      if (pendingTimer.current !== null) {
        window.clearTimeout(pendingTimer.current);
        pendingTimer.current = null;
      }
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (helpOpen) return;
      if (isEditableTarget(event.target)) return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j') {
        if (assistantNavReady && onToggleAssistant) {
          event.preventDefault();
          onToggleAssistant();
        }
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (pendingG.current) {
        const letter = event.key.toLowerCase();
        const match = navShortcuts.find((entry) => entry.keys === `g ${letter}`);
        clearPendingG();
        if (match) {
          event.preventDefault();
          go(match.path);
        }
        return;
      }

      if (event.key === 'g') {
        pendingG.current = true;
        pendingTimer.current = window.setTimeout(clearPendingG, 1000);
        return;
      }

      if (event.key === 'n') {
        event.preventDefault();
        composer?.openCreate();
        return;
      }

      if (event.key === '?') {
        event.preventDefault();
        setHelpOpen(true);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      clearPendingG();
    };
  }, [assistantNavReady, composer, go, helpOpen, navShortcuts, onToggleAssistant]);

  const rows = [
    { keys: '⌘ K', label: t('palette') },
    ...(assistantNavReady ? [{ keys: '⌘ J', label: t('toggleAssistant') }] : []),
    { keys: 'n', label: t('newTransaction') },
    { keys: 'g h', label: t('goDashboard') },
    { keys: 'g l', label: t('goLedger') },
    { keys: 'g b', label: t('goBudgets') },
    { keys: 'g g', label: t('goGoals') },
    { keys: 'g r', label: t('goReports') },
    { keys: 'g s', label: t('goSettings') },
    { keys: '?', label: t('showHelp') },
  ];

  return (
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <ul className="space-y-2 text-sm">
          {rows.map((row) => (
            <li key={row.keys} className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">{row.label}</span>
              <kbd className="rounded border border-border bg-surface px-2 py-0.5 font-mono text-xs">
                {row.keys}
              </kbd>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
