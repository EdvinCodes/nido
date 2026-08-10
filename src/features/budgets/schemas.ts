import { z } from 'zod';

export const budgetScopeSchema = z.enum([
  'space',
  'category',
  'participant',
  'category_participant',
]);
export const budgetPeriodSchema = z.enum(['day', 'week', 'month', 'quarter', 'year']);

const thresholdSchema = z.union([
  z.literal(25),
  z.literal(50),
  z.literal(75),
  z.literal(80),
  z.literal(90),
  z.literal(100),
  z.literal(110),
  z.literal(120),
  z.literal(150),
  z.literal(200),
]);

const baseBudgetFields = {
  spaceId: z.uuid(),
  name: z.string().trim().min(1).max(80),
  scope: budgetScopeSchema,
  categoryId: z.uuid().nullish(),
  participantId: z.uuid().nullish(),
  period: budgetPeriodSchema.default('month'),
  limitMinor: z.number().int().positive(),
  includeSubcategories: z.boolean().default(true),
  rollover: z.boolean().default(false),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endsOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullish(),
  alertThresholds: z.array(thresholdSchema).min(1).default([50, 80, 100]),
};

function refineScope(
  value: {
    scope: z.infer<typeof budgetScopeSchema>;
    categoryId?: string | null | undefined;
    participantId?: string | null | undefined;
  },
  ctx: z.RefinementCtx,
) {
  const hasCat = Boolean(value.categoryId);
  const hasPart = Boolean(value.participantId);
  const ok =
    (value.scope === 'space' && !hasCat && !hasPart) ||
    (value.scope === 'category' && hasCat && !hasPart) ||
    (value.scope === 'participant' && !hasCat && hasPart) ||
    (value.scope === 'category_participant' && hasCat && hasPart);
  if (!ok) {
    ctx.addIssue({
      code: 'custom',
      message: 'Scope fields do not match scope type.',
      path: ['scope'],
    });
  }
}

export const createBudgetSchema = z.object(baseBudgetFields).superRefine(refineScope);

export const updateBudgetSchema = z
  .object({
    ...baseBudgetFields,
    budgetId: z.uuid(),
    isActive: z.boolean().optional(),
  })
  .superRefine(refineScope);

export const deleteBudgetSchema = z.object({
  spaceId: z.uuid(),
  budgetId: z.uuid(),
});

export const acceptSuggestionsSchema = z.object({
  spaceId: z.uuid(),
  items: z
    .array(
      z.object({
        categoryId: z.uuid(),
        name: z.string().trim().min(1).max(80),
        limitMinor: z.number().int().positive(),
      }),
    )
    .min(1),
});

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
