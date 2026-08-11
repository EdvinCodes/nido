import { notFound } from 'next/navigation';
import { ReportDetailClient } from '@/features/reports/report-detail-client';
import { getPeriodSnapshot } from '@/features/reports/queries';

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ spaceId: string; snapshotId: string }>;
}) {
  const { spaceId, snapshotId } = await params;
  const snapshot = await getPeriodSnapshot(spaceId, snapshotId);
  if (!snapshot) notFound();

  return (
    <ReportDetailClient
      spaceId={spaceId}
      from={snapshot.period_from}
      to={snapshot.period_to}
      payload={snapshot.payload}
    />
  );
}
