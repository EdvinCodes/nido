import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';

export type AiConsentRow = Database['nido']['Tables']['ai_consent']['Row'];
export type AiConversationRow = Database['nido']['Tables']['ai_conversations']['Row'];
export type AiMessageRow = Database['nido']['Tables']['ai_messages']['Row'];
export type AiInsightRow = Database['nido']['Tables']['ai_insights']['Row'];

export async function getAiConsent(spaceId: string): Promise<AiConsentRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ai_consent')
    .select('*')
    .eq('space_id', spaceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export function isConsentActive(consent: AiConsentRow | null): boolean {
  return Boolean(consent && !consent.revoked_at);
}

export async function countUserMessagesToday(userId: string): Promise<number> {
  const supabase = await createClient();
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const { data: convs } = await supabase
    .from('ai_conversations')
    .select('id')
    .eq('user_id', userId);
  const ids = (convs ?? []).map((c) => c.id);
  if (!ids.length) return 0;
  const { count, error } = await supabase
    .from('ai_messages')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'user')
    .gte('created_at', start.toISOString())
    .in('conversation_id', ids);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function listConversations(
  spaceId: string,
  userId: string,
): Promise<AiConversationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('*')
    .eq('space_id', spaceId)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function loadConversationMessages(conversationId: string): Promise<AiMessageRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export async function listActiveInsights(spaceId: string): Promise<AiInsightRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ai_insights')
    .select('*')
    .eq('space_id', spaceId)
    .is('dismissed_at', null)
    .order('created_at', { ascending: false })
    .limit(3);
  if (error) throw new Error(error.message);
  return data;
}
