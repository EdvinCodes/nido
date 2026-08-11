import { z } from 'zod';

export const createAttachmentSchema = z.object({
  spaceId: z.uuid(),
  transactionId: z.uuid().nullish(),
  storagePath: z.string().min(8).max(500),
  thumbPath: z.string().min(8).max(500).nullish(),
  mimeType: z.enum([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf',
  ]),
  sizeBytes: z.number().int().positive().max(10_485_760),
  width: z.number().int().positive().nullish(),
  height: z.number().int().positive().nullish(),
  blurhash: z.string().max(100).nullish(),
});

export const attachmentIdSchema = z.object({
  spaceId: z.uuid(),
  attachmentId: z.uuid(),
});

export const signedUrlSchema = attachmentIdSchema.extend({
  thumb: z.boolean().optional(),
});

export const linkAttachmentSchema = z.object({
  spaceId: z.uuid(),
  attachmentId: z.uuid(),
  transactionId: z.uuid(),
});

export const listAttachmentsSchema = z.object({
  spaceId: z.uuid(),
  transactionId: z.uuid().optional(),
});
