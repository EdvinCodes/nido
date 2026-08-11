'use server';

import { revalidatePath } from 'next/cache';
import { authedAction } from '@/lib/auth/authed-action';
import {
  attachmentIdSchema,
  createAttachmentSchema,
  linkAttachmentSchema,
  signedUrlSchema,
} from './schemas';

function revalidateAttachments(spaceId: string): void {
  revalidatePath(`/s/${spaceId}/ledger`);
  revalidatePath(`/s/${spaceId}/receipts`);
}

export const createAttachment = authedAction()
  .schema(createAttachmentSchema)
  .space(({ input }) => input.spaceId)
  .action(async ({ input, ctx }) => {
    const { data, error } = await ctx.supabase
      .from('attachments')
      .insert({
        space_id: input.spaceId,
        transaction_id: input.transactionId ?? null,
        storage_path: input.storagePath,
        thumb_path: input.thumbPath ?? null,
        mime_type: input.mimeType,
        size_bytes: input.sizeBytes,
        width: input.width ?? null,
        height: input.height ?? null,
        blurhash: input.blurhash ?? null,
        uploaded_by: ctx.userId,
        ocr_status: 'none',
      })
      .select('id')
      .single();

    if (error) {
      return {
        ok: false as const,
        error: { code: 'attachment_create_failed', message: error.message },
      };
    }

    revalidateAttachments(input.spaceId);
    return { ok: true as const, data: { id: data.id } };
  });

export const linkAttachment = authedAction()
  .schema(linkAttachmentSchema)
  .space(({ input }) => input.spaceId)
  .action(async ({ input, ctx }) => {
    const { error } = await ctx.supabase
      .from('attachments')
      .update({ transaction_id: input.transactionId })
      .eq('id', input.attachmentId)
      .eq('space_id', input.spaceId);

    if (error) {
      return {
        ok: false as const,
        error: { code: 'attachment_link_failed', message: error.message },
      };
    }

    revalidateAttachments(input.spaceId);
    return { ok: true as const, data: { linked: true as const } };
  });

export const deleteAttachment = authedAction()
  .schema(attachmentIdSchema)
  .space(({ input }) => input.spaceId)
  .action(async ({ input, ctx }) => {
    const { data: row, error: fetchError } = await ctx.supabase
      .from('attachments')
      .select('storage_path, thumb_path')
      .eq('id', input.attachmentId)
      .eq('space_id', input.spaceId)
      .single();

    if (fetchError) {
      return {
        ok: false as const,
        error: {
          code: 'attachment_not_found',
          message: fetchError.message,
        },
      };
    }

    const paths = [row.storage_path, row.thumb_path].filter(
      (p): p is string => typeof p === 'string' && p.length > 0,
    );
    if (paths.length > 0) {
      await ctx.supabase.storage.from('receipts').remove(paths);
    }

    const { error } = await ctx.supabase
      .from('attachments')
      .delete()
      .eq('id', input.attachmentId)
      .eq('space_id', input.spaceId);

    if (error) {
      return {
        ok: false as const,
        error: { code: 'attachment_delete_failed', message: error.message },
      };
    }

    revalidateAttachments(input.spaceId);
    return { ok: true as const, data: { deleted: true as const } };
  });

export const getAttachmentSignedUrl = authedAction()
  .schema(signedUrlSchema)
  .space(({ input }) => input.spaceId)
  .action(async ({ input, ctx }) => {
    const { data: row, error } = await ctx.supabase
      .from('attachments')
      .select('storage_path, thumb_path')
      .eq('id', input.attachmentId)
      .eq('space_id', input.spaceId)
      .single();

    if (error) {
      return {
        ok: false as const,
        error: { code: 'attachment_not_found', message: error.message },
      };
    }

    const path = input.thumb && row.thumb_path ? row.thumb_path : row.storage_path;
    const { data, error: signError } = await ctx.supabase.storage
      .from('receipts')
      .createSignedUrl(path, 60);

    if (signError) {
      return {
        ok: false as const,
        error: {
          code: 'signed_url_failed',
          message: signError.message,
        },
      };
    }

    return {
      ok: true as const,
      data: { url: data.signedUrl, expiresIn: 60 as const },
    };
  });
