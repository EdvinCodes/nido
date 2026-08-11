import { notFound } from 'next/navigation';
import { getRecentCurrencies } from '@/features/reports/queries';
import { getSpaceForMember } from '@/features/spaces/queries';
import { SpaceSettingsForm } from '@/features/spaces/space-settings-form';

export default async function SpaceSettingsPage({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}) {
  const { spaceId } = await params;
  const membership = await getSpaceForMember(spaceId);
  if (!membership) notFound();

  const recentCurrencies = await getRecentCurrencies(spaceId);

  return (
    <SpaceSettingsForm
      spaceId={spaceId}
      role={membership.role}
      baseCurrency={membership.space.base_currency}
      recentCurrencies={recentCurrencies}
    />
  );
}
