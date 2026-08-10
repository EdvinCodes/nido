import { z } from 'zod';

export const createGoalSchema = z.object({
  spaceId: z.uuid(),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).nullish(),
  targetMinor: z.number().int().positive(),
  currency: z.string().length(3),
  targetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullish(),
  accountId: z.uuid().nullish(),
  color: z.string().min(4).max(32).default('#8B8B8B'),
  icon: z.string().trim().min(1).max(40).default('piggy-bank'),
});

export const updateGoalSchema = createGoalSchema.extend({
  goalId: z.uuid(),
  status: z.enum(['active', 'reached', 'paused', 'archived']).optional(),
});

export const deleteGoalSchema = z.object({
  spaceId: z.uuid(),
  goalId: z.uuid(),
});

export const contributeGoalSchema = z
  .object({
    spaceId: z.uuid(),
    goalId: z.uuid(),
    participantId: z.uuid(),
    amountMinor: z
      .number()
      .int()
      .refine((n) => n !== 0),
    contributedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    note: z.string().trim().max(500).nullish(),
    asTransfer: z.boolean().default(false),
    fromAccountId: z.uuid().nullish(),
    toAccountId: z.uuid().nullish(),
  })
  .superRefine((value, ctx) => {
    if (value.amountMinor < 0 && !value.note?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'Withdrawal requires a reason.',
        path: ['note'],
      });
    }
    if (value.asTransfer && (!value.fromAccountId || !value.toAccountId)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Transfer contribution needs both accounts.',
        path: ['asTransfer'],
      });
    }
  });

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
export type ContributeGoalInput = z.infer<typeof contributeGoalSchema>;
