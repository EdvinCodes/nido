'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { authedAction, type ActionResult } from '@/lib/auth/authed-action';
import { clientEnv, getServerEnv } from '@/lib/env';
import type { Database } from '@/lib/supabase/database.types';
import {
  acceptInviteSchema,
  createSpaceSchema,
  inviteMemberSchema,
  removeMemberSchema,
  revokeInviteSchema,
  updateMemberRoleSchema,
  updateProfileSchema,
} from './schemas';

export const createSpaceAction = authedAction()
  .schema(createSpaceSchema)
  .action(async ({ input, ctx }) => {
    const participants = input.participants.map((p) => ({
      display_name: p.displayName,
      ...(p.color ? { color: p.color } : {}),
    }));

    const { data, error } = await ctx.supabase.rpc('create_space', {
      p_name: input.name,
      p_kind: input.kind,
      p_currency: input.currency as never,
      p_timezone: input.timezone,
      p_participants: participants,
      p_month_starts_on: input.monthStartsOn,
      p_week_starts_on: input.weekStartsOn,
      ...(input.categoryKeys ? { p_category_keys: input.categoryKeys } : {}),
    });

    if (error || !data) {
      return {
        ok: false as const,
        error: {
          code: 'create_space_failed',
          message: error?.message ?? 'Could not create space.',
        },
      };
    }

    revalidatePath('/');
    return { ok: true as const, data: { spaceId: data } };
  });

export const updateProfileAction = authedAction()
  .schema(updateProfileSchema)
  .action(async ({ input, ctx }) => {
    const patch: Database['nido']['Tables']['profiles']['Update'] = {};
    if (input.displayName !== undefined) patch.display_name = input.displayName;
    if (input.locale !== undefined) patch.locale = input.locale;
    if (input.timezone !== undefined) patch.timezone = input.timezone;
    if (input.theme !== undefined) patch.theme = input.theme;
    if (input.colourblindSafe !== undefined) patch.colourblind_safe = input.colourblindSafe;
    if (input.lastActiveSpaceId !== undefined) patch.last_active_space_id = input.lastActiveSpaceId;

    const { error } = await ctx.supabase.from('profiles').update(patch).eq('id', ctx.userId);
    if (error) {
      return {
        ok: false as const,
        error: { code: 'profile_update_failed', message: error.message },
      };
    }

    revalidatePath('/');
    return { ok: true as const, data: { updated: true as const } };
  });

export const inviteMemberAction = authedAction()
  .schema(inviteMemberSchema)
  .space(({ input }) => input.spaceId, { action: 'members.invite' })
  .action(async ({ input, ctx }) => {
    const token = randomBytes(32).toString('hex');
    const { createHash } = await import('node:crypto');
    const tokenHash = createHash('sha256').update(token, 'utf8').digest('hex');

    const { data: invitation, error } = await ctx.supabase
      .from('space_invitations')
      .insert({
        space_id: input.spaceId,
        email: input.email ?? null,
        token_hash: tokenHash,
        role: input.role,
        participant_id: input.participantId ?? null,
        invited_by: ctx.userId,
      })
      .select('id, expires_at')
      .single();

    if (error) {
      return { ok: false as const, error: { code: 'invite_failed', message: error.message } };
    }

    const link = `${clientEnv.NEXT_PUBLIC_APP_URL}/invite/${token}`;

    // Best-effort email; never fail the invite if mail cannot be sent.
    if (input.email) {
      try {
        const env = getServerEnv();
        if (env.RESEND_API_KEY) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${env.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'Nido <onboarding@resend.dev>',
              to: [input.email],
              subject: 'You are invited to a Nido space',
              text: `Join with this link (expires in 7 days):\n\n${link}`,
            }),
          });
        }
      } catch {
        // ignore
      }
    }

    revalidatePath(`/s/${input.spaceId}/settings/members`);
    return {
      ok: true as const,
      data: { invitationId: invitation.id, token, link, expiresAt: invitation.expires_at },
    };
  });

export const revokeInviteAction = authedAction()
  .schema(revokeInviteSchema)
  .space(({ input }) => input.spaceId, { action: 'members.manage' })
  .action(async ({ input, ctx }) => {
    const { error } = await ctx.supabase
      .from('space_invitations')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', input.invitationId)
      .eq('space_id', input.spaceId)
      .is('accepted_at', null);

    if (error) {
      return { ok: false as const, error: { code: 'revoke_failed', message: error.message } };
    }

    revalidatePath(`/s/${input.spaceId}/settings/members`);
    return { ok: true as const, data: { revoked: true as const } };
  });

export const updateMemberRoleAction = authedAction()
  .schema(updateMemberRoleSchema)
  .space(({ input }) => input.spaceId, { action: 'members.manage' })
  .action(async ({ input, ctx }) => {
    if (input.role === 'owner' && !canOwner(ctx.role)) {
      return {
        ok: false as const,
        error: { code: 'forbidden', message: 'Only an owner may transfer ownership.' },
      };
    }

    const { error } = await ctx.supabase
      .from('space_members')
      .update({ role: input.role })
      .eq('space_id', input.spaceId)
      .eq('user_id', input.userId);

    if (error) {
      return { ok: false as const, error: { code: 'role_update_failed', message: error.message } };
    }

    revalidatePath(`/s/${input.spaceId}/settings/members`);
    return { ok: true as const, data: { updated: true as const } };
  });

export const removeMemberAction = authedAction()
  .schema(removeMemberSchema)
  .space(({ input }) => input.spaceId, { action: 'members.manage' })
  .action(async ({ input, ctx }) => {
    const { error } = await ctx.supabase
      .from('space_members')
      .update({ status: 'removed' })
      .eq('space_id', input.spaceId)
      .eq('user_id', input.userId);

    if (error) {
      return { ok: false as const, error: { code: 'remove_failed', message: error.message } };
    }

    revalidatePath(`/s/${input.spaceId}/settings/members`);
    return { ok: true as const, data: { removed: true as const } };
  });

export const acceptInviteAction = authedAction()
  .schema(acceptInviteSchema)
  .action(async ({ input, ctx }) => {
    const { data, error } = await ctx.supabase.rpc('accept_invitation', { p_token: input.token });
    if (error || !data) {
      return {
        ok: false as const,
        error: { code: 'invite_invalid', message: 'Invitation is invalid or expired.' },
      };
    }

    revalidatePath('/');
    return { ok: true as const, data: { spaceId: data } };
  });

function canOwner(role: string): boolean {
  return role === 'owner';
}

export async function uploadAvatarAction(
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: { code: 'validation', message: 'Missing file.' } };
  }

  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: { code: 'unauthenticated', message: 'You must be signed in.' } };
  }

  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${user.id}/${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage.from('avatars').upload(path, buffer, {
    contentType: file.type || 'image/jpeg',
    upsert: true,
  });
  if (uploadError) {
    return { ok: false, error: { code: 'upload_failed', message: uploadError.message } };
  }

  const { data: signed } = await supabase.storage
    .from('avatars')
    .createSignedUrl(path, 60 * 60 * 24 * 365);

  const url = signed?.signedUrl;
  if (!url) {
    return { ok: false, error: { code: 'upload_failed', message: 'Could not sign URL.' } };
  }

  const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);
  if (error) {
    return { ok: false, error: { code: 'profile_update_failed', message: error.message } };
  }

  revalidatePath('/');
  return { ok: true, data: { url } };
}

export type InviteResult = ActionResult<{
  invitationId: string;
  token: string;
  link: string;
  expiresAt: string;
}>;
