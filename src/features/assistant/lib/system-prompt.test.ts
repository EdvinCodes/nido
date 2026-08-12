import { describe, expect, it } from 'vitest';
import { buildSystemPrompt } from './system-prompt';

describe('buildSystemPrompt', () => {
  it('requires copying formatted tool money and raw minor integers', () => {
    const prompt = buildSystemPrompt({
      spaceName: 'Home',
      baseCurrency: 'EUR',
      timezone: 'Europe/Madrid',
      monthStartsOn: 1,
      today: '2026-08-12',
      categories: [{ id: 'c1', name: 'Food', kind: 'expense' }],
      participants: [{ id: 'p1', label: 'A' }],
      locale: 'en',
    });
    expect(prompt).toContain('(minor: 12345)');
    expect(prompt).toContain('Copy `formatted`');
    expect(prompt).toContain('<<<DATA>>>');
  });
});
