import { z } from 'zod';

export const settlementMethodSchema = z.enum(['cash', 'transfer', 'bizum', 'other']);

export const proposeSettlementSchema = z.object({
  spaceId: z.uuid(),
  fromParticipantId: z.uuid(),
  toParticipantId: z.uuid(),
  amountMinor: z.number().int().positive(),
  currency: z.string().length(3),
  method: settlementMethodSchema.nullish(),
  note: z.string().trim().max(2000).nullish(),
  settledOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const confirmSettlementSchema = z.object({
  spaceId: z.uuid(),
  settlementId: z.uuid(),
  amountMinor: z.number().int().positive().optional(),
});

export const disputeSettlementSchema = z.object({
  spaceId: z.uuid(),
  settlementId: z.uuid(),
  note: z.string().trim().min(1).max(2000),
});

export const reverseSettlementSchema = z.object({
  spaceId: z.uuid(),
  settlementId: z.uuid(),
});

export const balanceBreakdownSchema = z.object({
  spaceId: z.uuid(),
  participantId: z.uuid(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullish(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullish(),
});

export const spaceIdSchema = z.object({
  spaceId: z.uuid(),
});

export type ProposeSettlementInput = z.infer<typeof proposeSettlementSchema>;
export type SettlementMethod = z.infer<typeof settlementMethodSchema>;
