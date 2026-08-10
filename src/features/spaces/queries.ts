import { createClient } from '@/lib/supabase/server';
import type { MemberRole } from '@/lib/auth';

export async function getProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return data;
}

export async function getUserSpaces() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('space_members')
    .select(
      `
      role,
      status,
      participant_id,
      spaces (
        id,
        name,
        kind,
        base_currency,
        timezone,
        archived_at
      )
    `,
    )
    .eq('user_id', user.id)
    .eq('status', 'active');

  const rows = data ?? [];
  const result: Array<{
    role: MemberRole;
    participantId: string;
    space: {
      id: string;
      name: string;
      kind: 'solo' | 'couple' | 'shared';
      base_currency: string;
      timezone: string;
      archived_at: string | null;
    };
  }> = [];

  for (const row of rows) {
    const space = row.spaces;
    if (space.archived_at) continue;
    result.push({
      role: row.role,
      participantId: row.participant_id,
      space,
    });
  }

  return result;
}

export async function getSpaceForMember(spaceId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from('space_members')
    .select('role, participant_id, status')
    .eq('space_id', spaceId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!membership) return null;

  const { data: space } = await supabase.from('spaces').select('*').eq('id', spaceId).maybeSingle();
  if (!space) return null;

  return {
    space,
    role: membership.role,
    participantId: membership.participant_id,
    userId: user.id,
  };
}

export async function getSpaceMembers(spaceId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('space_members')
    .select(
      `
      role,
      status,
      joined_at,
      user_id,
      participant_id,
      profiles:user_id ( id, display_name, avatar_url ),
      participants:participant_id ( id, display_name, color, avatar_url, user_id, is_active )
    `,
    )
    .eq('space_id', spaceId)
    .order('joined_at', { ascending: true });

  return data ?? [];
}

export async function getGhostParticipants(spaceId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('participants')
    .select('*')
    .eq('space_id', spaceId)
    .is('user_id', null)
    .eq('is_active', true)
    .order('position', { ascending: true });

  return data ?? [];
}

export async function getPendingInvitations(spaceId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('space_invitations')
    .select('id, email, role, expires_at, created_at, participant_id, invited_by')
    .eq('space_id', spaceId)
    .is('accepted_at', null)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });

  return data ?? [];
}

export async function getCategories(spaceId: string, includeArchived = false) {
  const supabase = await createClient();
  let query = supabase
    .from('categories')
    .select('*')
    .eq('space_id', spaceId)
    .order('position', { ascending: true });

  if (!includeArchived) {
    query = query.is('archived_at', null);
  }

  const { data } = await query;
  return data ?? [];
}
