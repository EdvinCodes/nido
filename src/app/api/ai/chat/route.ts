import {
  ToolLoopAgent,
  createAgentUIStreamResponse,
  getToolName,
  isToolUIPart,
  stepCountIs,
  type UIMessage,
} from 'ai';
import { getLocale } from 'next-intl/server';
import { createAssistantTools } from '@/features/assistant/tools';
import { buildSystemPrompt } from '@/features/assistant/lib/system-prompt';
import { prepareHistoryForModel } from '@/features/assistant/lib/history';
import { mapProviderError } from '@/features/assistant/lib/provider-errors';
import { createUserUiMessage, dbMessagesToUi } from '@/features/assistant/lib/message-mapper';
import { chatRequestSchema } from '@/features/assistant/schemas';
import {
  countUserMessagesToday,
  getAiConsent,
  isConsentActive,
  loadConversationMessages,
} from '@/features/assistant/queries';
import { getModel, getModelLabel } from '@/lib/ai/providers';
import { isAssistantConfigured } from '@/lib/ai/assistant-enabled';
import { createClient } from '@/lib/supabase/server';
import { todayIn } from '@/lib/dates';

export const runtime = 'nodejs';

const DAILY_LIMIT = Number(process.env.AI_DAILY_MESSAGE_LIMIT ?? 50);

export async function POST(req: Request): Promise<Response> {
  if (!isAssistantConfigured()) {
    return new Response(JSON.stringify({ error: 'ai_not_configured' }), { status: 404 });
  }

  const model = getModel();
  if (!model) {
    return new Response(JSON.stringify({ error: 'ai_not_configured' }), { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400 });
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'validation' }), {
      status: 400,
    });
  }

  const { spaceId, conversationId, message } = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401 });
  }

  const { data: membership, error: memberError } = await supabase
    .from('space_members')
    .select('role, participant_id')
    .eq('space_id', spaceId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (memberError || !membership) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 });
  }

  const consent = await getAiConsent(spaceId);
  if (!isConsentActive(consent) || !consent) {
    return new Response(JSON.stringify({ error: 'consent_required' }), { status: 403 });
  }

  const usedToday = await countUserMessagesToday(user.id);
  if (usedToday >= DAILY_LIMIT) {
    return new Response(
      JSON.stringify({
        error: 'rate_limit',
        message: `Daily limit of ${DAILY_LIMIT} messages reached. Try again tomorrow.`,
      }),
      { status: 429 },
    );
  }

  const { data: space, error: spaceError } = await supabase
    .from('spaces')
    .select('name, base_currency, timezone, month_starts_on')
    .eq('id', spaceId)
    .single();
  if (spaceError) {
    return new Response(JSON.stringify({ error: 'space_not_found' }), { status: 404 });
  }

  const [{ data: categories }, { data: participants }] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name, kind')
      .eq('space_id', spaceId)
      .is('archived_at', null),
    supabase
      .from('participants')
      .select('id, display_name, position')
      .eq('space_id', spaceId)
      .eq('is_active', true)
      .order('position'),
  ]);

  const locale = await getLocale();
  let convId = conversationId;
  if (!convId) {
    const { data: conv, error: convError } = await supabase
      .from('ai_conversations')
      .insert({ space_id: spaceId, user_id: user.id, title: message.slice(0, 80) })
      .select('id')
      .single();
    if (convError) {
      return new Response(JSON.stringify({ error: 'db_error' }), { status: 500 });
    }
    convId = conv.id;
  }

  await supabase.from('ai_messages').insert({
    conversation_id: convId,
    space_id: spaceId,
    role: 'user',
    content: { text: message },
  });

  const historyRows = await loadConversationMessages(convId);
  const historyUi = prepareHistoryForModel(dbMessagesToUi(historyRows));
  const uiMessages: UIMessage[] = [...historyUi];
  if (
    !historyUi.some(
      (m) => m.role === 'user' && m.parts.some((p) => p.type === 'text' && p.text === message),
    )
  ) {
    uiMessages.push(createUserUiMessage(message));
  }

  const participantLabels =
    participants?.map((p, index) => ({
      id: p.id,
      label: consent.use_real_names ? p.display_name : String.fromCharCode(65 + index),
    })) ?? [];

  const instructions = buildSystemPrompt({
    spaceName: space.name,
    baseCurrency: space.base_currency,
    timezone: space.timezone,
    monthStartsOn: space.month_starts_on,
    today: todayIn(space.timezone),
    categories: categories ?? [],
    participants: participantLabels,
    locale,
  });

  const toolCtx = {
    spaceId,
    userId: user.id,
    baseCurrency: space.base_currency,
    locale,
    supabase,
    useRealNames: consent.use_real_names,
  };

  const agent = new ToolLoopAgent({
    model,
    instructions,
    tools: createAssistantTools(toolCtx),
    stopWhen: stepCountIs(8),
  });

  const modelLabel = getModelLabel();
  const activeConvId = convId;
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    return await createAgentUIStreamResponse({
      agent,
      uiMessages,
      headers: { 'X-Conversation-Id': activeConvId },
      onError: (error) => mapProviderError(error).message,
      onStepEnd: ({ usage }) => {
        inputTokens += usage.inputTokens ?? 0;
        outputTokens += usage.outputTokens ?? 0;
      },
      onFinish: async ({ messages }) => {
        const last = messages.at(-1);
        if (!last || last.role !== 'assistant') return;

        const toolCalls = last.parts
          .filter((part) => isToolUIPart(part))
          .map((part) => {
            if (!isToolUIPart(part)) return null;
            return {
              toolCallId: part.toolCallId,
              toolName: getToolName(part),
              state: part.state,
              input: 'input' in part ? part.input : undefined,
            };
          })
          .filter((row): row is NonNullable<typeof row> => row !== null);

        await supabase.from('ai_messages').insert({
          conversation_id: activeConvId,
          space_id: spaceId,
          role: 'assistant',
          content: JSON.parse(JSON.stringify({ parts: last.parts, model: modelLabel })),
          tool_calls: toolCalls.length ? JSON.parse(JSON.stringify(toolCalls)) : null,
          token_usage: {
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens,
            model: modelLabel,
          },
        });
        await supabase
          .from('ai_conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', activeConvId);
      },
    });
  } catch (error) {
    const mapped = mapProviderError(error);
    return new Response(JSON.stringify({ error: mapped.code, message: mapped.message }), {
      status: mapped.status,
    });
  }
}
