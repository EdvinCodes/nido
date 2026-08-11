import { notFound } from 'next/navigation';
import { CompareReportsClient } from '@/features/reports/compare-client';
import { getSpaceForMember } from '@/features/spaces/queries';
import { currentPeriod, previousPeriod } from '@/lib/dates/periods';

export default async function CompareReportsPage({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}) {
  const { spaceId } = await params;
  const membership = await getSpaceForMember(spaceId);
  if (!membership) notFound();

  const opts = {
    timeZone: membership.space.timezone,
    monthStartsOn: membership.space.month_starts_on,
    weekStartsOn: membership.space.week_starts_on,
  };
  const current = currentPeriod('month', opts);
  const previous = previousPeriod('month', current, opts);

  return (
    <CompareReportsClient
      spaceId={spaceId}
      baseCurrency={membership.space.base_currency}
      defaultLeft={previous}
      defaultRight={current}
    />
  );
}
