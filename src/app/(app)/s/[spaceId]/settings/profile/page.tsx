import { notFound } from 'next/navigation';
import { ProfileForm } from '@/features/spaces/profile-form';
import { getProfile, getSpaceForMember } from '@/features/spaces/queries';

export default async function ProfileSettingsPage({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}) {
  const { spaceId } = await params;
  const membership = await getSpaceForMember(spaceId);
  if (!membership) notFound();
  const profile = await getProfile();
  if (!profile) notFound();

  return (
    <ProfileForm
      userId={membership.userId}
      profile={{
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        locale: profile.locale,
        timezone: profile.timezone,
        theme: profile.theme,
        colourblind_safe: profile.colourblind_safe,
      }}
    />
  );
}
