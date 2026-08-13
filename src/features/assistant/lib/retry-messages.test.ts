import { describe, expect, it } from 'vitest';
import { dropLastUserTurn } from './retry-messages';

describe('dropLastUserTurn', () => {
  it('removes the last user message and the failed assistant reply', () => {
    const next = dropLastUserTurn([
      { role: 'user', id: 'u1' },
      { role: 'assistant', id: 'a1' },
      { role: 'user', id: 'u2' },
      { role: 'assistant', id: 'a2' },
    ]);
    expect(next.map((m) => m.id)).toEqual(['u1', 'a1']);
  });

  it('returns the original list when there is no user turn', () => {
    const messages = [{ role: 'assistant', id: 'a1' }];
    expect(dropLastUserTurn(messages)).toEqual(messages);
  });
});
