'use client';

import { createClient } from '@/lib/supabase/client';

/** Kick off receipt OCR after processing completes. */
export async function invokeReceiptExtract(input: {
  attachmentId: string;
  categories: { id: string; name: string }[];
}): Promise<void> {
  const supabase = createClient();
  await supabase.functions.invoke('receipt-extract', {
    body: input,
  });
}
