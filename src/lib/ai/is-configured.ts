import { getServerEnv } from '@/lib/env';

/** True when a vision-capable AI provider is configured for receipt extraction. */
export function isAiConfigured(): boolean {
  const env = getServerEnv();
  if (!env.AI_PROVIDER) return false;

  switch (env.AI_PROVIDER) {
    case 'openai':
      return Boolean(env.OPENAI_API_KEY);
    case 'anthropic':
      return Boolean(env.ANTHROPIC_API_KEY);
    case 'google':
      return Boolean(env.GOOGLE_GENERATIVE_AI_API_KEY);
    case 'ollama':
      return Boolean(env.OLLAMA_BASE_URL ?? 'http://localhost:11434');
    default:
      return false;
  }
}
