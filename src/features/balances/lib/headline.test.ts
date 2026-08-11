import { describe, expect, it } from 'vitest';
import { balanceHeadline } from './headline';
import type { ParticipantBalance } from '../types';

function bal(id: string, name: string, net: number, position = 0): ParticipantBalance {
  return {
    participantId: id,
    displayName: name,
    color: '#000',
    position,
    userId: null,
    paidMinor: 0,
    owedMinor: 0,
    netMinor: net,
  };
}

describe('balanceHeadline', () => {
  it('returns square when nets are zero', () => {
    expect(balanceHeadline([bal('a', 'Ana', 0), bal('b', 'Edvin', 0)], [])).toEqual({
      kind: 'square',
    });
  });

  it('names the largest simplified transfer', () => {
    expect(
      balanceHeadline(
        [bal('a', 'Ana', -100), bal('b', 'Edvin', 100)],
        [{ fromId: 'a', toId: 'b', amountMinor: 100 }],
      ),
    ).toEqual({
      kind: 'owes',
      fromName: 'Ana',
      toName: 'Edvin',
      amountMinor: 100,
    });
  });
});
