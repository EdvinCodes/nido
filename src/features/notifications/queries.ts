import { createClient } from '@/lib/supabase/server';
import type { NotificationKind } from './schemas';

export type NotificationRow = {
  id: string;
  space_id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
  payload: Record<string, unknown>;
};

const MATRIX_KINDS: NotificationKind[] = [
  'budget_threshold',
  'budget_exceeded',
  'recurring_due',
  'recurring_price_change',
  'goal_reached',
  'settlement_request',
  'settlement_confirmed',
  'member_joined',
  'import_finished',
  'bank_sync_failed',
  'insight',
];

export async function listNotifications(spaceId: string, limit = 40): Promise<NotificationRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('notifications')
    .select('id, space_id, kind, title, body, link, read_at, created_at, payload')
    .eq('space_id', spaceId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data.map((row) => {
    const payload =
      typeof row.payload === 'object' && row.payload !== null && !Array.isArray(row.payload)
        ? (row.payload as Record<string, unknown>)
        : {};
    return {
      id: row.id,
      space_id: row.space_id,
      kind: row.kind,
      title: row.title,
      body: row.body,
      link: row.link,
      read_at: row.read_at,
      created_at: row.created_at,
      payload,
    };
  });
}

export async function getUnreadNotificationCount(spaceId: string): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('space_id', spaceId)
    .eq('user_id', user.id)
    .is('read_at', null);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export type PreferenceRow = {
  kind: NotificationKind;
  inApp: boolean;
  push: boolean;
  email: boolean;
};

export async function listNotificationPreferences(spaceId: string): Promise<PreferenceRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('notification_preferences')
    .select('kind, in_app, push, email')
    .eq('space_id', spaceId)
    .eq('user_id', user.id);

  const map = new Map((data ?? []).map((r) => [r.kind, r]));
  return MATRIX_KINDS.map((kind) => {
    const row = map.get(kind);
    return {
      kind,
      inApp: row?.in_app ?? true,
      push: false,
      email: false,
    };
  });
}
