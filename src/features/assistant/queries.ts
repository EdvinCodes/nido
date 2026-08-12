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

export type MonthlyTokenUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  messageCount: number;
  estimatedCostUsd: number | null;
};

/** Rough USD estimate for common cloud providers; null for Ollama / unknown. */
export function estimateTokenCostUsd(
  provider: string | null | undefined,
  inputTokens: number,
  outputTokens: number,
): number | null {
  const rates: Record<string, { inPerM: number; outPerM: number }> = {
    openai: { inPerM: 0.15, outPerM: 0.6 },
    anthropic: { inPerM: 3, outPerM: 15 },
    google: { inPerM: 0.1, outPerM: 0.4 },
  };
  if (!provider || provider === 'ollama') return null;
  const rate = rates[provider];
  if (!rate) return null;
  return (inputTokens / 1_000_000) * rate.inPerM + (outputTokens / 1_000_000) * rate.outPerM;
}

export async function getMonthlyTokenUsage(
  spaceId: string,
  userId: string,
  provider: string | null,
): Promise<MonthlyTokenUsage> {
  const supabase = await createClient();
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);

  const { data: convs } = await supabase
    .from('ai_conversations')
    .select('id')
    .eq('space_id', spaceId)
    .eq('user_id', userId);
  const ids = (convs ?? []).map((c) => c.id);
  if (!ids.length) {
    return {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      messageCount: 0,
      estimatedCostUsd: estimateTokenCostUsd(provider, 0, 0),
    };
  }

  const { data, error } = await supabase
    .from('ai_messages')
    .select('token_usage')
    .eq('role', 'assistant')
    .gte('created_at', start.toISOString())
    .in('conversation_id', ids);
  if (error) throw new Error(error.message);

  const rows = data;
  let inputTokens = 0;
  let outputTokens = 0;
  for (const row of rows) {
    const usage = row.token_usage as {
      inputTokens?: number;
      outputTokens?: number;
    } | null;
    if (!usage) continue;
    inputTokens += usage.inputTokens ?? 0;
    outputTokens += usage.outputTokens ?? 0;
  }

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    messageCount: rows.length,
    estimatedCostUsd: estimateTokenCostUsd(provider, inputTokens, outputTokens),
  };
}
