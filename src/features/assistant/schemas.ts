import { z } from 'zod';

export const aiProviderNameSchema = z.enum(['openai', 'anthropic', 'google', 'ollama']);

export const chatRequestSchema = z.object({
  spaceId: z.uuid(),
  conversationId: z.uuid().optional(),
  message: z.string().min(1).max(4000),
  provider: aiProviderNameSchema.optional(),
});

export const consentSchema = z.object({
  spaceId: z.uuid(),
  useRealNames: z.boolean().default(false),
  retentionDays: z.number().int().min(7).max(365).default(90),
});

export const revokeConsentSchema = z.object({
  spaceId: z.uuid(),
});

export const renameConversationSchema = z.object({
  spaceId: z.uuid(),
  conversationId: z.uuid(),
  title: z.string().min(1).max(120),
});

export const deleteConversationSchema = z.object({
  spaceId: z.uuid(),
  conversationId: z.uuid(),
});

export const exportConversationSchema = z.object({
  spaceId: z.uuid(),
  conversationId: z.uuid(),
});

export const dismissInsightSchema = z.object({
  spaceId: z.uuid(),
  insightId: z.uuid(),
});

export const updateAiPreferencesSchema = z.object({
  spaceId: z.uuid(),
  useRealNames: z.boolean(),
  retentionDays: z.number().int().min(7).max(365),
});
