import { describe, expect, it } from 'vitest';
import { listConfiguredProvidersFrom } from './provider-names';

describe('listConfiguredProvidersFrom', () => {
  it('returns empty when nothing is set', () => {
    expect(listConfiguredProvidersFrom({})).toEqual([]);
  });

  it('lists only providers with credentials', () => {
    expect(
      listConfiguredProvidersFrom({
        OPENAI_API_KEY: 'sk-test',
        ANTHROPIC_API_KEY: 'ant-test',
      }),
    ).toEqual(['openai', 'anthropic']);
  });

  it('includes ollama when it is the active provider even without a custom URL', () => {
    expect(listConfiguredProvidersFrom({ AI_PROVIDER: 'ollama' })).toEqual(['ollama']);
  });
});
