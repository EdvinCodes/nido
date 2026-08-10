import { notFound } from 'next/navigation';
import { NotificationsSettings } from '@/features/notifications/notifications-settings';
import { listNotificationPreferences } from '@/features/notifications/queries';
import { getSpaceForMember } from '@/features/spaces/queries';

export default async function NotificationsSettingsPage({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}) {
  const { spaceId } = await params;
  const membership = await getSpaceForMember(spaceId);
  if (!membership) notFound();

  const preferences = await listNotificationPreferences(spaceId);

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <NotificationsSettings spaceId={spaceId} preferences={preferences} />
    </main>
  );
}
