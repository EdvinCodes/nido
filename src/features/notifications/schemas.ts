import { z } from 'zod';

export const notificationKindSchema = z.enum([
  'budget_threshold',
  'budget_exceeded',
  'recurring_due',
  'recurring_price_change',
  'goal_reached',
  'settlement_request',
  'settlement_confirmed',
  'member_joined',
  'import_finished',
  'bank_sync_failed',
  'insight',
  'period_close',
]);

export const markReadSchema = z.object({
  spaceId: z.uuid(),
  notificationId: z.uuid(),
});

export const markAllReadSchema = z.object({
  spaceId: z.uuid(),
});

export const updatePreferenceSchema = z.object({
  spaceId: z.uuid(),
  kind: notificationKindSchema,
  inApp: z.boolean(),
});

export type NotificationKind = z.infer<typeof notificationKindSchema>;
