'use server';

import { authedAction } from '@/lib/auth/authed-action';
import { getModelLabel } from '@/lib/ai/providers';
import { isAssistantConfigured } from '@/lib/ai/assistant-enabled';
import { getServerEnv } from '@/lib/env';
import {
  consentSchema,
  deleteConversationSchema,
  dismissInsightSchema,
  exportConversationSchema,
  renameConversationSchema,
  revokeConsentSchema,
} from './schemas';
import { loadConversationMessages } from './queries';

const CONSENT_TEXT =
  'Nido sends aggregated figures, category names, merchant names, and up to fifty transaction rows per question to the configured AI provider. Email addresses, IBANs, and attachment contents are never sent.';

export const grantAiConsentAction = authedAction()
  .schema(consentSchema)
  .space(({ input }) => input.spaceId, { action: 'space.update' })
  .action(async ({ input, ctx }) => {
    if (!isAssistantConfigured()) {
      return {
        ok: false,
        error: { code: 'ai_disabled', message: 'AI provider is not configured.' },
      };
    }
    const provider = getServerEnv().AI_PROVIDER;
    if (!provider) {
      return {
        ok: false,
        error: { code: 'ai_disabled', message: 'AI provider is not configured.' },
      };
    }

    const { error } = await ctx.supabase.from('ai_consent').upsert({
      space_id: input.spaceId,
      consented_by: ctx.userId,
      consented_at: new Date().toISOString(),
      provider,
      consent_text: CONSENT_TEXT,
      use_real_names: input.useRealNames,
      retention_days: input.retentionDays,
      revoked_at: null,
      revoked_by: null,
    });
    if (error) return { ok: false, error: { code: 'db_error', message: error.message } };
    return { ok: true, data: { provider, model: getModelLabel() } };
  });

export const revokeAiConsentAction = authedAction()
  .schema(revokeConsentSchema)
  .space(({ input }) => input.spaceId, { action: 'space.update' })
  .action(async ({ input, ctx }) => {
    const { error } = await ctx.supabase.rpc('ai_revoke_consent', { p_space_id: input.spaceId });
    if (error) return { ok: false, error: { code: 'db_error', message: error.message } };
    return { ok: true, data: { revoked: true } };
  });

export const renameConversationAction = authedAction()
  .schema(renameConversationSchema)
  .space(({ input }) => input.spaceId)
  .action(async ({ input, ctx }) => {
    const { error } = await ctx.supabase
      .from('ai_conversations')
      .update({ title: input.title, updated_at: new Date().toISOString() })
      .eq('id', input.conversationId)
      .eq('user_id', ctx.userId)
      .eq('space_id', input.spaceId);
    if (error) return { ok: false, error: { code: 'db_error', message: error.message } };
    return { ok: true, data: { title: input.title } };
  });

export const deleteConversationAction = authedAction()
  .schema(deleteConversationSchema)
  .space(({ input }) => input.spaceId)
  .action(async ({ input, ctx }) => {
    const { error } = await ctx.supabase
      .from('ai_conversations')
      .delete()
      .eq('id', input.conversationId)
      .eq('user_id', ctx.userId)
      .eq('space_id', input.spaceId);
    if (error) return { ok: false, error: { code: 'db_error', message: error.message } };
    return { ok: true, data: { deleted: true } };
  });

export const exportConversationAction = authedAction()
  .schema(exportConversationSchema)
  .space(({ input }) => input.spaceId)
  .action(async ({ input, ctx }) => {
    const { data: conv, error: convError } = await ctx.supabase
      .from('ai_conversations')
      .select('title, created_at')
      .eq('id', input.conversationId)
      .eq('user_id', ctx.userId)
      .eq('space_id', input.spaceId)
      .maybeSingle();
    if (convError || !conv) {
      return { ok: false, error: { code: 'not_found', message: 'Conversation not found.' } };
    }

    const messages = await loadConversationMessages(input.conversationId);
    const lines = [
      `# ${conv.title ?? 'Conversation'}`,
      '',
      `Exported ${new Date().toISOString()}`,
      '',
    ];
    for (const msg of messages) {
      const content = msg.content as { text?: string; parts?: unknown[]; model?: string };
      if (msg.role === 'user' && content.text) {
        lines.push(`## You`, '', content.text, '');
      } else if (msg.role === 'assistant') {
        lines.push(`## Assistant${content.model ? ` (${content.model})` : ''}`, '');
        const text = extractAssistantText(content.parts);
        lines.push(text || '_(empty)_', '');
      }
    }
    return { ok: true, data: { markdown: lines.join('\n') } };
  });

export const dismissInsightAction = authedAction()
  .schema(dismissInsightSchema)
  .space(({ input }) => input.spaceId)
  .action(async ({ input, ctx }) => {
    const { error } = await ctx.supabase
      .from('ai_insights')
      .update({ dismissed_at: new Date().toISOString(), dismissed_by: ctx.userId })
      .eq('id', input.insightId)
      .eq('space_id', input.spaceId);
    if (error) return { ok: false, error: { code: 'db_error', message: error.message } };
    return { ok: true, data: { dismissed: true } };
  });

function extractAssistantText(parts: unknown[] | undefined): string {
  if (!parts?.length) return '';
  return parts
    .flatMap((part) => {
      if (typeof part !== 'object' || part === null) return [];
      const typed = part as { type?: string; text?: string };
      if (typed.type === 'text' && typed.text) return [typed.text];
      return [];
    })
    .join('\n');
}
