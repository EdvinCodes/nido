import { z } from 'zod';
import { PERIOD_PRESETS } from '@/lib/dates';

export const spaceSummarySchema = z.object({
  spaceId: z.uuid(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  participantId: z.uuid().nullable().optional(),
});

export const spaceSeriesSchema = z.object({
  spaceId: z.uuid(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  granularity: z.enum(['day', 'week', 'month']).default('day'),
});

export const searchTransactionsSchema = z.object({
  spaceId: z.uuid(),
  query: z.string().trim().min(1).max(120),
  limit: z.number().int().min(1).max(50).default(20),
});

export const persistPeriodPreferenceSchema = z.object({
  spaceId: z.uuid(),
  preset: z.enum(PERIOD_PRESETS),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
});
