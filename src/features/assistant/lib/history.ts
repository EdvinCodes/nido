import type { UIMessage } from 'ai';
import { extractTextFromUiMessage } from './message-mapper';

/** Keep the newest N turns as full messages; summarise older ones into one system note. */
export const HISTORY_RECENT_LIMIT = 24;

export type HistoryBudget = {
  recentLimit?: number;
};

/**
 * Caps conversation history for the model. Older turns become a single summary message
 * instead of being truncated mid-turn.
 */
export function prepareHistoryForModel(
  messages: UIMessage[],
  options: HistoryBudget = {},
): UIMessage[] {
  const recentLimit = options.recentLimit ?? HISTORY_RECENT_LIMIT;
  if (messages.length <= recentLimit) return messages;

  const older = messages.slice(0, -recentLimit);
  const recent = messages.slice(-recentLimit);
  const summaryLines = older.map((message) => {
    const role =
      message.role === 'assistant' ? 'Assistant' : message.role === 'user' ? 'User' : message.role;
    const text = extractTextFromUiMessage(message).replace(/\s+/g, ' ').trim();
    const clipped = text.length > 240 ? `${text.slice(0, 237)}…` : text;
    return `- ${role}: ${clipped || '(tool/empty)'}`;
  });

  const summaryMessage: UIMessage = {
    id: 'history-summary',
    role: 'assistant',
    parts: [
      {
        type: 'text',
        text: ['Earlier conversation summary (older turns condensed):', ...summaryLines].join('\n'),
      },
    ],
  };

  return [summaryMessage, ...recent];
}
