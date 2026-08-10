import { z } from 'zod';

const splitParticipantSchema = z.object({
  participantId: z.uuid(),
  weight: z.number().nonnegative().optional(),
  owedMinor: z.number().int().nonnegative().optional(),
});

export const createRuleSchema = z.object({
  spaceId: z.uuid(),
  kind: z.enum(['subscription', 'bill', 'income', 'transfer']).default('subscription'),
  name: z.string().trim().min(1).max(80),
  merchant: z.string().trim().max(120).nullish(),
  amountMinor: z.number().int().positive(),
  currency: z.string().length(3),
  categoryId: z.uuid().nullish(),
  accountId: z.uuid().nullish(),
  payerParticipantId: z.uuid().nullish(),
  splitMode: z.enum(['equal', 'personal', 'shares', 'percent', 'exact']).default('equal'),
  splitConfig: z.array(splitParticipantSchema).default([]),
  freq: z.enum(['day', 'week', 'month', 'year']).default('month'),
  intervalCount: z.number().int().positive().default(1),
  byMonthDay: z.number().int().min(-1).max(31).nullish(),
  byWeekday: z.number().int().min(0).max(6).nullish(),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nextRunOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  autoCreate: z.boolean().default(true),
  reminderDaysBefore: z.number().int().min(0).max(30).default(2),
});

export const updateRuleSchema = createRuleSchema.extend({
  ruleId: z.uuid(),
  isActive: z.boolean().optional(),
  cancelUrl: z.url().nullish().or(z.literal('')),
});

export const cancelRuleSchema = z.object({
  spaceId: z.uuid(),
  ruleId: z.uuid(),
  cancelUrl: z.url().nullish().or(z.literal('')),
});

export const ghostAnswerSchema = z.object({
  spaceId: z.uuid(),
  ruleId: z.uuid(),
  answer: z.enum(['yes', 'no', 'unsure']),
  cancelUrl: z.url().nullish().or(z.literal('')),
});

export const acceptCandidateSchema = z.object({
  spaceId: z.uuid(),
  merchant: z.string().trim().min(1).max(120),
  amountMinor: z.number().int().positive(),
  currency: z.string().length(3),
  categoryId: z.uuid().nullish(),
  accountId: z.uuid().nullish(),
  payerParticipantId: z.uuid().nullish(),
  splitMode: z.enum(['equal', 'personal', 'shares', 'percent', 'exact']).default('equal'),
  freq: z.enum(['day', 'week', 'month', 'year']).default('month'),
  intervalCount: z.number().int().positive().default(1),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nextRunOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  transactionIds: z.array(z.uuid()).default([]),
});

export type CreateRuleInput = z.infer<typeof createRuleSchema>;
export type AcceptCandidateInput = z.infer<typeof acceptCandidateSchema>;
