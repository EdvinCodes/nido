/**
 * Uploads a few demo receipt images into the local Supabase receipts bucket and links
 * them to recent demo-space expenses. Run after `pnpm db:reset`:
 *   node scripts/seed-demo-receipts.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local');
  try {
    const text = readFileSync(path, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // rely on process env
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const alexId = '00000000-0000-4000-8000-0000000000a1';

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function receiptPng(label, amount) {
  const svg = `<svg width="480" height="640" xmlns="http://www.w3.org/2000/svg">
  <rect width="480" height="640" fill="#f7f4ef"/>
  <rect x="24" y="24" width="432" height="592" rx="12" fill="#fff" stroke="#e6e0d6"/>
  <text x="48" y="80" font-family="Georgia,serif" font-size="28" fill="#1c1a18">nido demo</text>
  <text x="48" y="120" font-family="system-ui,sans-serif" font-size="18" fill="#6b6560">${label}</text>
  <line x1="48" y1="148" x2="432" y2="148" stroke="#e6e0d6"/>
  <text x="48" y="200" font-family="system-ui,sans-serif" font-size="16" fill="#6b6560">Item A</text>
  <text x="360" y="200" font-family="ui-monospace,monospace" font-size="16" fill="#1c1a18">12.40</text>
  <text x="48" y="236" font-family="system-ui,sans-serif" font-size="16" fill="#6b6560">Item B</text>
  <text x="360" y="236" font-family="ui-monospace,monospace" font-size="16" fill="#1c1a18">8.90</text>
  <line x1="48" y1="280" x2="432" y2="280" stroke="#e6e0d6"/>
  <text x="48" y="320" font-family="system-ui,sans-serif" font-size="20" font-weight="600" fill="#1c1a18">Total</text>
  <text x="330" y="320" font-family="ui-monospace,monospace" font-size="20" fill="#1c1a18">${amount}</text>
  <text x="48" y="560" font-family="system-ui,sans-serif" font-size="13" fill="#9a948c">Demo receipt · local seed</text>
</svg>`;
  const full = await sharp(Buffer.from(svg)).png().toBuffer();
  const thumb = await sharp(full).resize(240, 320, { fit: 'cover' }).png().toBuffer();
  return { full, thumb, width: 480, height: 640 };
}

const { data: membership, error: memErr } = await supabase
  .schema('nido')
  .from('space_members')
  .select('space_id')
  .eq('user_id', alexId)
  .eq('status', 'active')
  .limit(1)
  .maybeSingle();

if (memErr || !membership) {
  console.error('Demo space not found. Run `pnpm db:reset` first.', memErr?.message);
  process.exit(1);
}

const spaceId = membership.space_id;

const { data: txs, error: txErr } = await supabase
  .schema('nido')
  .from('transactions')
  .select('id, booked_on, merchant, description')
  .eq('space_id', spaceId)
  .eq('kind', 'expense')
  .is('deleted_at', null)
  .order('booked_on', { ascending: false })
  .limit(4);

if (txErr || !txs?.length) {
  console.error('No expense transactions to attach receipts to.', txErr?.message);
  process.exit(1);
}

const labels = [
  ['Mercadona', '21.30'],
  ['Can Roca', '68.50'],
  ['Farmacia', '12.40'],
  ['Iberdrola', '87.30'],
];

let uploaded = 0;
for (let i = 0; i < Math.min(txs.length, labels.length); i++) {
  const tx = txs[i];
  const [label, amount] = labels[i];
  const { full, thumb, width, height } = await receiptPng(label, amount);
  const yyyy = tx.booked_on.slice(0, 4);
  const mm = tx.booked_on.slice(5, 7);
  const id = crypto.randomUUID();
  const storagePath = `${spaceId}/${yyyy}/${mm}/${id}.png`;
  const thumbPath = `${spaceId}/${yyyy}/${mm}/${id}-thumb.png`;

  const upFull = await supabase.storage.from('receipts').upload(storagePath, full, {
    contentType: 'image/png',
    upsert: true,
  });
  if (upFull.error) {
    console.error('Upload failed', upFull.error.message);
    continue;
  }
  const upThumb = await supabase.storage.from('receipts').upload(thumbPath, thumb, {
    contentType: 'image/png',
    upsert: true,
  });
  if (upThumb.error) {
    console.error('Thumb upload failed', upThumb.error.message);
    continue;
  }

  const { error: insertErr } = await supabase.schema('nido').from('attachments').insert({
    id,
    space_id: spaceId,
    transaction_id: tx.id,
    storage_path: storagePath,
    thumb_path: thumbPath,
    mime_type: 'image/png',
    size_bytes: full.length,
    width,
    height,
    blurhash: null,
    ocr_status: 'none',
    uploaded_by: alexId,
  });

  if (insertErr) {
    console.error('Attachment insert failed', insertErr.message);
    continue;
  }
  uploaded += 1;
}

console.log(`Seeded ${uploaded} demo receipts for space ${spaceId}`);
