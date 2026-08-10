import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { LedgerClient } from '@/features/transactions/ledger-client';
import { parseLedgerFiltersFromSearchParams } from '@/features/transactions/lib/parse-ledger-filters';
import { listTags, listTransactions } from '@/features/transactions/queries';
import { getSpaceForMember } from '@/features/spaces/queries';

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

  const membership = await getSpaceForMember(spaceId);
  if (!membership) notFound();

  const filters = parseLedgerFiltersFromSearchParams(sp, membership.participantId);
  const [initialPage, tags] = await Promise.all([
    listTransactions({ spaceId, filters, limit: 50 }),
    listTags(spaceId),
  ]);

  return (
    <main className="flex min-h-0 flex-1 flex-col" aria-label={t('title')}>
      <LedgerClient
        spaceId={spaceId}
        initialPage={initialPage}
        initialFilters={filters}
        tags={tags}
      />
    </main>
  );
}
