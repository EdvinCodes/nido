import { notFound } from 'next/navigation';
import { ReportsClient } from '@/features/reports/reports-client';
import { getSavingsRateSeries, listPeriodSnapshots } from '@/features/reports/queries';
import { getSpaceForMember } from '@/features/spaces/queries';

export default async function ReportsPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const membership = await getSpaceForMember(spaceId);
  if (!membership) notFound();

  const [snapshots, savingsSeries] = await Promise.all([
    listPeriodSnapshots(spaceId),
    getSavingsRateSeries(spaceId),
  ]);

  return (
    <ReportsClient
      spaceId={spaceId}
      baseCurrency={membership.space.base_currency}
      snapshots={snapshots}
      savingsSeries={savingsSeries}
    />
  );
}
