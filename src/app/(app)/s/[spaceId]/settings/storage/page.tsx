import { notFound } from 'next/navigation';
import { StorageSettings } from '@/features/attachments/storage-settings';
import { getStorageUsage } from '@/features/attachments/queries';
import { getSpaceForMember } from '@/features/spaces/queries';

export default async function StorageSettingsPage({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}) {
  const { spaceId } = await params;
  const membership = await getSpaceForMember(spaceId);
  if (!membership) notFound();

  const usage = await getStorageUsage(spaceId);

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <StorageSettings usage={usage} />
    </main>
  );
}
