/**
 * Weekly purge: remove storage objects for stale attachment rows, then hard-delete rows.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

type StaleRow = {
  id: string;
  storage_path: string;
  thumb_path: string | null;
};

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET');
  const auth = req.headers.get('authorization') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  const isCron = Boolean(secret && auth === `Bearer ${secret}`);
  const isService = auth === `Bearer ${serviceKey}`;
  if (!isCron && !isService) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'nido' },
  });

  const cutoff30 = new Date(Date.now() - 30 * 86400000).toISOString();
  const cutoff7 = new Date(Date.now() - 7 * 86400000).toISOString();

  const { data: deletedTxs, error: txError } = await admin
    .from('transactions')
    .select('id')
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoff30);

  if (txError) {
    return new Response(JSON.stringify({ error: txError.message }), { status: 500 });
  }

  const txIds = (deletedTxs ?? []).map((row) => row.id);
  let softDeletedAttachments: StaleRow[] = [];
  if (txIds.length > 0) {
    const { data, error } = await admin
      .from('attachments')
      .select('id, storage_path, thumb_path')
      .in('transaction_id', txIds);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
    softDeletedAttachments = (data ?? []) as StaleRow[];
  }

  const { data: orphans, error: orphanError } = await admin
    .from('attachments')
    .select('id, storage_path, thumb_path')
    .is('transaction_id', null)
    .lt('created_at', cutoff7);

  if (orphanError) {
    return new Response(JSON.stringify({ error: orphanError.message }), { status: 500 });
  }

  const doomed: StaleRow[] = [...softDeletedAttachments, ...((orphans ?? []) as StaleRow[])];

  const paths = [
    ...new Set(
      doomed.flatMap((row) =>
        [row.storage_path, row.thumb_path].filter(
          (p): p is string => typeof p === 'string' && p.length > 0,
        ),
      ),
    ),
  ];

  if (paths.length > 0) {
    const { error: storageError } = await admin.storage.from('receipts').remove(paths);
    if (storageError) {
      console.error('attachment-purge storage remove failed', storageError);
    }
  }

  const { data: deletedCount, error: purgeError } = await admin.rpc('purge_stale_attachments');
  if (purgeError) {
    return new Response(JSON.stringify({ error: purgeError.message }), { status: 500 });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      storage_paths: paths.length,
      rows_deleted: deletedCount ?? 0,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
