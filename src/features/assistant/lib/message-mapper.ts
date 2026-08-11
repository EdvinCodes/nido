import { generateId, type UIMessage } from 'ai';
import type { AiMessageRow } from '../queries';

/** Restores persisted messages into AI SDK UI messages. */
export function dbMessagesToUi(rows: AiMessageRow[]): UIMessage[] {
  const messages: UIMessage[] = [];
  for (const row of rows) {
    const content = row.content as {
      text?: string;
      parts?: UIMessage['parts'];
      model?: string;
    };
    if (row.role === 'user' && content.text) {
      messages.push({
        id: row.id,
        role: 'user',
        parts: [{ type: 'text', text: content.text }],
      });
      continue;
    }
    if (row.role === 'assistant' && content.parts?.length) {
      messages.push({
        id: row.id,
        role: 'assistant',
        parts: content.parts,
        ...(content.model ? { metadata: { model: content.model } } : {}),
      });
    }
  }
  return messages;
}

/** Creates a fresh user UI message. */
export function createUserUiMessage(text: string): UIMessage {
  return {
    id: generateId(),
    role: 'user',
    parts: [{ type: 'text', text }],
  };
}

export function extractTextFromUiMessage(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

export function extractModelFromUiMessage(message: UIMessage): string | undefined {
  const meta = message.metadata as { model?: string } | undefined;
  return meta?.model;
}
