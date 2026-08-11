import { describe, expect, it } from 'vitest';
import { buildSuggestedPrompts } from '@/features/assistant/lib/suggested-prompts';

describe('buildSuggestedPrompts', () => {
  it('includes core prompts and optional ones from space state', () => {
    const prompts = buildSuggestedPrompts({
      hasBudgets: true,
      hasGoals: false,
      hasSubscriptions: true,
    });
    expect(prompts.map((p) => p.id)).toEqual([
      'month-summary',
      'top-categories',
      'cut-200',
      'subscriptions',
    ]);
  });
});
