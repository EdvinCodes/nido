import { describe, expect, it } from 'vitest';
import { parseCommitLog } from './changelog';

describe('parseCommitLog', () => {
  it('keeps feat and fix subjects and drops the rest', () => {
    const entries = parseCommitLog(
      [
        'abc1234|2026-08-13|feat(ledger): add empty state action',
        'def5678|2026-08-12|chore(docs): update readme',
        'aaa9999|2026-08-11|fix(banking): remove dead connect link',
        'not-a-line',
      ].join('\n'),
    );
    expect(entries).toEqual([
      { tag: 'abc1234', date: '2026-08-13', message: 'feat(ledger): add empty state action' },
      { tag: 'aaa9999', date: '2026-08-11', message: 'fix(banking): remove dead connect link' },
    ]);
  });
});
