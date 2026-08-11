/**
 * Re-encode receipt images (strips EXIF/GPS), verify magic bytes, write dimensions
 * and a 320px thumbnail beside the original object.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';

type Body = {
  attachmentId: string;
};

function magicMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return 'application/pdf';
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405 });
  }

  const auth = req.headers.get('authorization') ?? '';
  const cron = Deno.env.get('CRON_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // Allow service role / cron, or a user JWT (membership checked via RLS on update).
  if (!serviceKey) {
    return new Response(JSON.stringify({ error: 'misconfigured' }), { status: 500 });
  }

  const body = (await req.json()) as Body;
  if (!body.attachmentId) {
    return new Response(JSON.stringify({ error: 'attachmentId required' }), { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'nido' },
  });

  const { data: row, error } = await admin
    .from('attachments')
    .select('id, space_id, storage_path, mime_type')
    .eq('id', body.attachmentId)
    .single();

  if (error || !row) {
    return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
  }

  // If caller is not service/cron, require a user JWT that can select the row.
  const isService = Boolean(cron && auth === `Bearer ${cron}`) || auth === `Bearer ${serviceKey}`;
  if (!isService) {
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false, autoRefreshToken: false },
      db: { schema: 'nido' },
    });
    const { data: visible } = await userClient
      .from('attachments')
      .select('id')
      .eq('id', body.attachmentId)
      .maybeSingle();
    if (!visible) {
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 });
    }
  }

  const { data: file, error: dlError } = await admin.storage
    .from('receipts')
    .download(row.storage_path);

  if (dlError || !file) {
    return new Response(JSON.stringify({ error: dlError?.message ?? 'download_failed' }), {
      status: 500,
    });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = magicMime(bytes);
  if (!detected) {
    return new Response(JSON.stringify({ error: 'unsupported_type' }), { status: 400 });
  }

  if (detected === 'application/pdf') {
    await admin.from('attachments').update({ mime_type: 'application/pdf' }).eq('id', row.id);
    return new Response(JSON.stringify({ ok: true, mime: 'application/pdf' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const image = await Image.decode(bytes);
  const width = image.width;
  const height = image.height;

  // Re-encode to WebP — drops EXIF including GPS.
  const encoded = await image.encodeWEBP(80);
  const cleanPath = row.storage_path.replace(/\.[^.]+$/, '.webp');
  const thumb = image.resize(Math.min(320, width), Image.RESIZE_AUTO);
  const thumbBytes = await thumb.encodeWEBP(75);
  const thumbPath = cleanPath.replace(/\.webp$/, '-thumb.webp');

  if (cleanPath !== row.storage_path) {
    await admin.storage.from('receipts').remove([row.storage_path]);
  }

  const { error: upError } = await admin.storage
    .from('receipts')
    .upload(cleanPath, encoded, { contentType: 'image/webp', upsert: true });
  if (upError) {
    return new Response(JSON.stringify({ error: upError.message }), { status: 500 });
  }

  await admin.storage
    .from('receipts')
    .upload(thumbPath, thumbBytes, { contentType: 'image/webp', upsert: true });

  await admin
    .from('attachments')
    .update({
      storage_path: cleanPath,
      thumb_path: thumbPath,
      mime_type: 'image/webp',
      size_bytes: encoded.byteLength,
      width,
      height,
    })
    .eq('id', row.id);

  return new Response(
    JSON.stringify({
      ok: true,
      width,
      height,
      size_bytes: encoded.byteLength,
      storage_path: cleanPath,
      thumb_path: thumbPath,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
