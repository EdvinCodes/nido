'use client';

import { createClient } from '@/lib/supabase/client';

export type ReceiptExtraction = {
  total_minor: number | null;
  currency: string | null;
  booked_on: string | null;
  merchant: string | null;
  tax_minor: number | null;
  category_id: string | null;
  category_name: string | null;
  line_items: { description: string | null; amount_minor: number | null }[] | null;
};

export async function pollReceiptExtraction(
  attachmentId: string,
  options?: { intervalMs?: number; maxAttempts?: number },
): Promise<ReceiptExtraction | null> {
  const intervalMs = options?.intervalMs ?? 1500;
  const maxAttempts = options?.maxAttempts ?? 40;
  const supabase = createClient();

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const { data, error } = await supabase
      .from('attachments')
      .select('ocr_status, ocr_result')
      .eq('id', attachmentId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    if (data.ocr_status === 'done' && data.ocr_result) {
      return data.ocr_result as ReceiptExtraction;
    }
    if (data.ocr_status === 'failed') return null;

    await new Promise((resolve) => {
      setTimeout(resolve, intervalMs);
    });
  }

  return null;
}
