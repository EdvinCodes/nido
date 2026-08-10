/**
 * Validation for account CRUD. Accounts are optional per transaction but required for
 * transfers and for balances. See docs/04-FEATURES.md § 2 and Phase 02 task 3.
 */

import { z } from 'zod';

export const accountKindSchema = z.enum(['cash', 'bank', 'card', 'savings', 'shared_pot', 'other']);

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const createAccountSchema = z.object({
  spaceId: z.uuid(),
  name: z.string().trim().min(1).max(80),
  kind: accountKindSchema.default('bank'),
  currency: z.string().length(3).optional(),
  ownerParticipantId: z.uuid().nullish(),
  openingBalanceMinor: z.number().int().default(0),
  color: hexColor.optional(),
  icon: z.string().trim().min(1).max(40).optional(),
  includeInTotals: z.boolean().default(true),
});

export const updateAccountSchema = z.object({
  spaceId: z.uuid(),
  accountId: z.uuid(),
  name: z.string().trim().min(1).max(80).optional(),
  kind: accountKindSchema.optional(),
  ownerParticipantId: z.uuid().nullish(),
  openingBalanceMinor: z.number().int().optional(),
  color: hexColor.optional(),
  icon: z.string().trim().min(1).max(40).optional(),
  includeInTotals: z.boolean().optional(),
});

export const archiveAccountSchema = z.object({
  spaceId: z.uuid(),
  accountId: z.uuid(),
  archived: z.boolean(),
});

export const reorderAccountsSchema = z.object({
  spaceId: z.uuid(),
  items: z.array(z.object({ id: z.uuid(), position: z.number().int().min(0) })).min(1),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
