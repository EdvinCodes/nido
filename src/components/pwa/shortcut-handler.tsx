'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransactionComposerOptional } from '@/features/transactions/composer-context';
import { route } from '@/lib/routes';

/** Opens the transaction composer from PWA manifest shortcuts (?action=). */
export function PwaShortcutHandler() {
  const params = useSearchParams();
  const router = useRouter();
  const composer = useTransactionComposerOptional();

  useEffect(() => {
    const action = params.get('action');
    if (!action || !composer) return;

    if (action === 'add-expense') composer.openCreate();
    if (action === 'scan-receipt') composer.openScanReceipt();

    const url = new URL(window.location.href);
    url.searchParams.delete('action');
    router.replace(route(url.pathname + url.search));
  }, [params, composer, router]);

  return null;
}
