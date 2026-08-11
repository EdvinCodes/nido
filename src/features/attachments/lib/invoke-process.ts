'use client';

import { createClient } from '@/lib/supabase/client';

/** Kick off server-side re-encode / EXIF strip after a client upload lands. */
export async function invokeReceiptProcess(attachmentId: string): Promise<void> {
  const supabase = createClient();
  await supabase.functions.invoke('receipt-process', {
    body: { attachmentId },
  });
}
