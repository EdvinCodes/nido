export type AiProviderName = 'openai' | 'anthropic' | 'google' | 'ollama';

export type ProviderEnvSlice = {
  AI_PROVIDER?: AiProviderName | undefined;
  OPENAI_API_KEY?: string | undefined;
  ANTHROPIC_API_KEY?: string | undefined;
  GOOGLE_GENERATIVE_AI_API_KEY?: string | undefined;
  OLLAMA_BASE_URL?: string | undefined;
};

/** Providers that have credentials in env. Ollama counts only when explicitly set. */
export function listConfiguredProvidersFrom(env: ProviderEnvSlice): AiProviderName[] {
  const names: AiProviderName[] = [];
  if (env.OPENAI_API_KEY) names.push('openai');
  if (env.ANTHROPIC_API_KEY) names.push('anthropic');
  if (env.GOOGLE_GENERATIVE_AI_API_KEY) names.push('google');
  if (env.OLLAMA_BASE_URL || env.AI_PROVIDER === 'ollama') names.push('ollama');
  return names;
}
