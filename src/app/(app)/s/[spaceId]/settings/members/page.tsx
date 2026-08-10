import { notFound } from 'next/navigation';
import { MembersManager } from '@/features/spaces/members-manager';
import {
  getGhostParticipants,
  getPendingInvitations,
  getSpaceForMember,
  getSpaceMembers,
} from '@/features/spaces/queries';

export default async function MembersSettingsPage({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}) {
  const { spaceId } = await params;
  const membership = await getSpaceForMember(spaceId);
  if (!membership) notFound();

  const [members, invitations, ghosts] = await Promise.all([
    getSpaceMembers(spaceId),
    getPendingInvitations(spaceId),
    getGhostParticipants(spaceId),
  ]);

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <MembersManager
        spaceId={spaceId}
        role={membership.role}
        members={members.map((m) => {
          const profile = m.profiles;
          return {
            user_id: m.user_id,
            role: m.role,
            status: m.status,
            joined_at: m.joined_at,
            profiles: Array.isArray(profile)
              ? null
              : {
                  id: profile.id,
                  display_name: profile.display_name,
                  avatar_url: profile.avatar_url,
                },
          };
        })}
        invitations={invitations}
        ghosts={ghosts}
      />
    </main>
  );
}
