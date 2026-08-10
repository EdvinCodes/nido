import { z } from 'zod';

export const spaceKindSchema = z.enum(['solo', 'couple', 'shared']);

export const createSpaceSchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: spaceKindSchema,
  currency: z.string().length(3),
  timezone: z.string().min(1).max(64),
  monthStartsOn: z.number().int().min(1).max(28).default(1),
  weekStartsOn: z.number().int().min(0).max(6).default(1),
  participants: z
    .array(
      z.object({
        displayName: z.string().trim().min(1).max(60),
        color: z
          .string()
          .regex(/^#[0-9A-Fa-f]{6}$/)
          .optional(),
      }),
    )
    .default([]),
  categoryKeys: z.array(z.string()).nullable().default(null),
});

export const inviteMemberSchema = z.object({
  spaceId: z.uuid(),
  email: z.email().optional(),
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
  participantId: z.uuid().optional(),
});

export const updateMemberRoleSchema = z.object({
  spaceId: z.uuid(),
  userId: z.uuid(),
  role: z.enum(['owner', 'admin', 'member', 'viewer']),
});

export const removeMemberSchema = z.object({
  spaceId: z.uuid(),
  userId: z.uuid(),
});

export const revokeInviteSchema = z.object({
  spaceId: z.uuid(),
  invitationId: z.uuid(),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(16),
});

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
  locale: z.enum(['es', 'en']).optional(),
  timezone: z.string().min(1).max(64).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  colourblindSafe: z.boolean().optional(),
  lastActiveSpaceId: z.uuid().nullable().optional(),
});

export const createCategorySchema = z.object({
  spaceId: z.uuid(),
  name: z.string().trim().min(1).max(50),
  kind: z.enum(['expense', 'income', 'both']),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  icon: z.string().min(1).max(40),
  parentId: z.uuid().nullable().optional(),
});

export const updateCategorySchema = z.object({
  spaceId: z.uuid(),
  categoryId: z.uuid(),
  name: z.string().trim().min(1).max(50).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  icon: z.string().min(1).max(40).optional(),
  parentId: z.uuid().nullable().optional(),
  position: z.number().int().min(0).optional(),
  archived: z.boolean().optional(),
});

export const reorderCategoriesSchema = z.object({
  spaceId: z.uuid(),
  items: z.array(
    z.object({
      id: z.uuid(),
      parentId: z.uuid().nullable(),
      position: z.number().int().min(0),
    }),
  ),
});

export type CreateSpaceInput = z.infer<typeof createSpaceSchema>;
