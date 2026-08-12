import { describe, expect, it } from 'vitest';
import type { UIMessage } from 'ai';
import { prepareHistoryForModel } from './history';

function msg(id: string, role: 'user' | 'assistant', text: string): UIMessage {
  return { id, role, parts: [{ type: 'text', text }] };
}

describe('prepareHistoryForModel', () => {
  it('returns messages unchanged when under the limit', () => {
    const messages = [msg('1', 'user', 'hi'), msg('2', 'assistant', 'hello')];
    expect(prepareHistoryForModel(messages, { recentLimit: 4 })).toEqual(messages);
  });

  it('summarises older turns instead of dropping them', () => {
    const messages = Array.from({ length: 6 }, (_, i) =>
      msg(String(i), i % 2 === 0 ? 'user' : 'assistant', `turn ${i}`),
    );
    const prepared = prepareHistoryForModel(messages, { recentLimit: 2 });
    expect(prepared).toHaveLength(3);
    expect(prepared[0]?.id).toBe('history-summary');
    const summaryText =
      prepared[0]?.parts[0] && prepared[0].parts[0].type === 'text'
        ? prepared[0].parts[0].text
        : '';
    expect(summaryText).toContain('Earlier conversation summary');
    expect(summaryText).toContain('turn 0');
    expect(prepared.at(-1)?.id).toBe('5');
  });
});
