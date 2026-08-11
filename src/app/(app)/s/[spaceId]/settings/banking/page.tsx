import { notFound } from 'next/navigation';
import { BankingSettings } from '@/features/banking/banking-settings';
import { isBankSyncEnabled } from '@/features/banking/lib';
import { getSpaceForMember } from '@/features/spaces/queries';

export default async function BankingSettingsPage({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}) {
  const { spaceId } = await params;
  const membership = await getSpaceForMember(spaceId);
  if (!membership) notFound();

  return <BankingSettings enabled={isBankSyncEnabled()} spaceId={spaceId} />;
}
