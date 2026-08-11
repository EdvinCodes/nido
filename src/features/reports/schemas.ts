import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const exportReportSchema = z.object({
  spaceId: z.uuid(),
  from: isoDate,
  to: isoDate,
  format: z.enum(['pdf', 'xlsx', 'csv']),
});

export const comparePeriodsSchema = z.object({
  spaceId: z.uuid(),
  leftFrom: isoDate,
  leftTo: isoDate,
  rightFrom: isoDate,
  rightTo: isoDate,
});

export const updateBaseCurrencySchema = z.object({
  spaceId: z.uuid(),
  baseCurrency: z.string().length(3),
});

export type ExportReportInput = z.infer<typeof exportReportSchema>;
export type ComparePeriodsInput = z.infer<typeof comparePeriodsSchema>;
export type UpdateBaseCurrencyInput = z.infer<typeof updateBaseCurrencySchema>;
