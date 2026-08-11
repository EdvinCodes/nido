import { notFound } from 'next/navigation';
import {
  getEmailConfigured,
  getPushConfigured,
  getVapidPublicKey,
} from '@/features/notifications/server-config';
import { NotificationsSettings } from '@/features/notifications/notifications-settings';
import { getQuietHours, listNotificationPreferences } from '@/features/notifications/queries';
import { getSpaceForMember } from '@/features/spaces/queries';

export default async function NotificationsSettingsPage({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}) {
  const { spaceId } = await params;
  const membership = await getSpaceForMember(spaceId);
  if (!membership) notFound();

  const [preferences, quietHours, emailConfigured, pushConfigured, vapidPublicKey] =
    await Promise.all([
      listNotificationPreferences(spaceId),
      getQuietHours(),
      Promise.resolve(getEmailConfigured()),
      Promise.resolve(getPushConfigured()),
      Promise.resolve(getVapidPublicKey()),
    ]);

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <NotificationsSettings
        spaceId={spaceId}
        preferences={preferences}
        quietHours={quietHours}
        emailConfigured={emailConfigured}
        pushConfigured={pushConfigured}
        vapidPublicKey={vapidPublicKey}
      />
    </main>
  );
}
