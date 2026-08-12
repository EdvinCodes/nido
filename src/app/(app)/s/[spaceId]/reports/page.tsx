import { notFound } from 'next/navigation';
import { ReportsClient } from '@/features/reports/reports-client';
import {
  generateLiveSnapshot,
  getSavingsRateSeries,
  listPeriodSnapshots,
} from '@/features/reports/queries';
import type { PeriodSnapshotPayload } from '@/features/reports/types';
import { getSpaceForMember } from '@/features/spaces/queries';
import { currentPeriod, previousPeriod } from '@/lib/dates/periods';

export default async function ReportsPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const membership = await getSpaceForMember(spaceId);
  if (!membership) notFound();

  const timeZone = membership.space.timezone;
  const monthStartsOn = membership.space.month_starts_on;
  const periodOpts = { timeZone, monthStartsOn };

  const current = currentPeriod('month', periodOpts);
  const previous = previousPeriod('month', current, periodOpts);
  const twoAgo = previousPeriod('month', previous, periodOpts);
  const openRanges = [current, previous, twoAgo];

  const [snapshots, savingsSeries, ...openPayloads] = await Promise.all([
    listPeriodSnapshots(spaceId),
    getSavingsRateSeries(spaceId),
    ...openRanges.map((range) => generateLiveSnapshot(spaceId, range.from, range.to)),
  ]);

  const openPeriods = openRanges.map((range, index) => ({
    periodFrom: range.from,
    periodTo: range.to,
    isCurrent: index === 0,
    payload: openPayloads[index] as PeriodSnapshotPayload,
  }));

  const series =
    savingsSeries.length > 0
      ? savingsSeries
      : openPeriods
          .slice()
          .reverse()
          .map((p) => ({
            periodFrom: p.periodFrom,
            periodTo: p.periodTo,
            savingsRate: p.payload.totals.savings_rate,
          }));

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <ReportsClient
        spaceId={spaceId}
        baseCurrency={membership.space.base_currency}
        snapshots={snapshots}
        savingsSeries={series}
        openPeriods={openPeriods}
      />
    </main>
  );
}
