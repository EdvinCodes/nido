/**
 * Server-side reads for attachments. Never call supabase.from('attachments') from components.
 */

import { createClient } from '@/lib/supabase/server';
import { listAttachmentsSchema } from './schemas';

export type AttachmentRow = {
  id: string;
  space_id: string;
  transaction_id: string | null;
  storage_path: string;
  thumb_path: string | null;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  ocr_status: string;
  ocr_result: unknown;
  uploaded_by: string;
  created_at: string;
};

export type AttachmentGalleryItem = Pick<
  AttachmentRow,
  | 'id'
  | 'transaction_id'
  | 'mime_type'
  | 'width'
  | 'height'
  | 'blurhash'
  | 'created_at'
  | 'ocr_status'
>;

export type AttachmentDateGroup = {
  date: string;
  items: AttachmentGalleryItem[];
};

export type StorageUsage = {
  bytes: number;
  count: number;
  limitBytes: number;
};

type StorageUsageRow = {
  bytes: number | string;
  count: number | string;
  limit_bytes: number | string;
};

export async function listByTransaction(
  spaceId: string,
  transactionId: string,
): Promise<AttachmentRow[]> {
  listAttachmentsSchema.parse({ spaceId, transactionId });
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('attachments')
    .select('*')
    .eq('space_id', spaceId)
    .eq('transaction_id', transactionId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

/** Space-wide gallery rows grouped by upload date (UTC calendar day). */
export async function listForSpace(spaceId: string): Promise<AttachmentDateGroup[]> {
  listAttachmentsSchema.parse({ spaceId });
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('attachments')
    .select('id, transaction_id, mime_type, width, height, blurhash, created_at, ocr_status')
    .eq('space_id', spaceId)
    .not('transaction_id', 'is', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  const rows = data as AttachmentGalleryItem[];
  const byDate = new Map<string, AttachmentGalleryItem[]>();
  for (const row of rows) {
    const date = row.created_at.slice(0, 10);
    const list = byDate.get(date) ?? [];
    list.push(row);
    byDate.set(date, list);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({ date, items }));
}

export async function getStorageUsage(spaceId: string): Promise<StorageUsage> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('space_storage_usage', {
    p_space_id: spaceId,
  });
  if (error) throw new Error(error.message);

  const payload = data as StorageUsageRow;
  return {
    bytes: Number(payload.bytes),
    count: Number(payload.count),
    limitBytes: Number(payload.limit_bytes),
  };
}
