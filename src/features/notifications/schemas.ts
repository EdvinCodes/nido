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
  inApp: z.boolean().optional(),
  push: z.boolean().optional(),
  email: z.boolean().optional(),
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  userAgent: z.string().optional(),
});

export const quietHoursSchema = z.object({
  spaceId: z.uuid(),
  enabled: z.boolean(),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(0).max(1439),
  timezone: z.string().min(1),
});

export const sendTestNotificationSchema = z.object({
  spaceId: z.uuid(),
  channel: z.enum(['push', 'email', 'in_app']),
});

export type NotificationKind = z.infer<typeof notificationKindSchema>;
