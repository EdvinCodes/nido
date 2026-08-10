import { getTranslations } from 'next-intl/server';
import { LedgerClient } from '@/features/transactions/ledger-client';
import { listTransactions } from '@/features/transactions/queries';
import type { TransactionFilters } from '@/features/transactions/schemas';

export default async function LedgerPage({
  params,
  searchParams,
}: {
  params: Promise<{ spaceId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { spaceId } = await params;
  const sp = await searchParams;
  const t = await getTranslations('ledger');

  const filters: TransactionFilters = {
    search: typeof sp.q === 'string' ? sp.q : undefined,
    kind:
      sp.kind === 'expense' || sp.kind === 'income' || sp.kind === 'transfer' ? sp.kind : undefined,
    dateFrom: typeof sp.from === 'string' && sp.from ? sp.from : undefined,
    dateTo: typeof sp.to === 'string' && sp.to ? sp.to : undefined,
  };

  const initialPage = await listTransactions({ spaceId, filters, limit: 50 });

  return (
    <main className="flex min-h-0 flex-1 flex-col" aria-label={t('title')}>
      <LedgerClient spaceId={spaceId} initialPage={initialPage} initialFilters={filters} />
    </main>
  );
}
