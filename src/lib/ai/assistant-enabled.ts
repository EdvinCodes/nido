import { isProviderConfigured, getConfiguredProvider } from '@/lib/ai/providers';

/** True when a chat-capable AI provider is configured. */
export function isAssistantConfigured(): boolean {
  const provider = getConfiguredProvider();
  if (!provider) return false;
  return isProviderConfigured(provider);
}

export { isAiConfigured } from '@/lib/ai/is-configured';
