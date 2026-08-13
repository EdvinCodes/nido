import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import { getServerEnv } from '@/lib/env';
import {
  listConfiguredProvidersFrom,
  type AiProviderName,
  type ProviderEnvSlice,
} from '@/lib/ai/provider-names';

export type { AiProviderName, ProviderEnvSlice };
export { listConfiguredProvidersFrom };

const DEFAULT_MODELS: Record<AiProviderName, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-sonnet-4-20250514',
  google: 'gemini-2.0-flash',
  ollama: 'llama3.2:3b',
};

export function getConfiguredProvider(): AiProviderName | null {
  const env = getServerEnv();
  if (!env.AI_PROVIDER) return null;
  return env.AI_PROVIDER;
}

export function isProviderConfigured(provider: AiProviderName): boolean {
  const env = getServerEnv();
  switch (provider) {
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

export function listConfiguredProviders(): AiProviderName[] {
  return listConfiguredProvidersFrom(getServerEnv());
}

function modelIdFor(provider: AiProviderName, override?: AiProviderName): string {
  const env = getServerEnv();
  if (override && override !== env.AI_PROVIDER) return DEFAULT_MODELS[provider];
  return env.AI_MODEL ?? DEFAULT_MODELS[provider];
}

/** Resolves the active AI SDK model, or null when the assistant is disabled. */
export function getModel(providerOverride?: AiProviderName): LanguageModel | null {
  const env = getServerEnv();
  const provider = providerOverride ?? env.AI_PROVIDER;
  if (!provider || !isProviderConfigured(provider)) return null;

  const modelId = modelIdFor(provider, providerOverride);

  switch (provider) {
    case 'anthropic':
      return anthropic(modelId);
    case 'google':
      return google(modelId);
    case 'openai': {
      const apiKey = env.OPENAI_API_KEY;
      if (!apiKey) return null;
      const openai = createOpenAI({ apiKey });
      return openai(modelId);
    }
    case 'ollama': {
      const baseURL = `${(env.OLLAMA_BASE_URL ?? 'http://localhost:11434').replace(/\/$/, '')}/v1`;
      const openai = createOpenAI({ baseURL, apiKey: 'ollama' });
      return openai(modelId);
    }
    default:
      return null;
  }
}

export function getModelLabel(providerOverride?: AiProviderName): string | null {
  const env = getServerEnv();
  const provider = providerOverride ?? env.AI_PROVIDER;
  if (!provider) return null;
  return `${provider}/${modelIdFor(provider, providerOverride)}`;
}
