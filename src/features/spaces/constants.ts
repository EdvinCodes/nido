import { z } from 'zod';

/** Default category keys shown in onboarding step 3. */
export const DEFAULT_CATEGORY_OPTIONS = [
  { key: 'housing', kind: 'expense' as const },
  { key: 'groceries', kind: 'expense' as const },
  { key: 'eating_out', kind: 'expense' as const },
  { key: 'transport', kind: 'expense' as const },
  { key: 'health', kind: 'expense' as const },
  { key: 'leisure', kind: 'expense' as const },
  { key: 'subscriptions', kind: 'expense' as const },
  { key: 'shopping', kind: 'expense' as const },
  { key: 'pets', kind: 'expense' as const },
  { key: 'travel', kind: 'expense' as const },
  { key: 'education', kind: 'expense' as const },
  { key: 'gifts_out', kind: 'expense' as const },
  { key: 'fees', kind: 'expense' as const },
  { key: 'other_expense', kind: 'expense' as const },
  { key: 'salary', kind: 'income' as const },
  { key: 'freelance', kind: 'income' as const },
  { key: 'refunds', kind: 'income' as const },
  { key: 'gifts_in', kind: 'income' as const },
  { key: 'investments', kind: 'income' as const },
  { key: 'other_income', kind: 'income' as const },
] as const;

export const CATEGORY_PALETTE = [
  '#C4A484',
  '#8FBC8F',
  '#E8A87C',
  '#6B8EAD',
  '#D4849A',
  '#9B8EC4',
  '#7BA3A8',
  '#D4A5A5',
  '#B8A98A',
  '#6A9BC3',
  '#8A9A5B',
  '#C49A6C',
] as const;

export const onboardingSearchSchema = z.object({
  step: z.coerce.number().int().min(1).max(3).default(1),
  kind: z.enum(['solo', 'couple', 'shared']).optional(),
  name: z.string().optional(),
  currency: z.string().length(3).optional(),
  timezone: z.string().optional(),
  monthStartsOn: z.coerce.number().int().min(1).max(28).optional(),
  participants: z.string().optional(), // comma-separated names
  categories: z.string().optional(), // comma-separated keys
  new: z.enum(['1']).optional(),
});
