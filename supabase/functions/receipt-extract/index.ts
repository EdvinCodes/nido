/**
 * Vision extraction for receipt photos. Non-fatal: failures never block the attachment.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { generateObject } from 'npm:ai@7';
import { anthropic } from 'npm:@ai-sdk/anthropic@4';
import { google } from 'npm:@ai-sdk/google@4';
import { createOpenAI } from 'npm:@ai-sdk/openai@4';
import { z } from 'npm:zod@4';

type Body = {
  attachmentId: string;
  categories: { id: string; name: string }[];
};

const CONFIDENCE = 0.7;

function resolveModel() {
  const provider = Deno.env.get('AI_PROVIDER');
  const modelId = Deno.env.get('AI_MODEL');

  if (provider === 'anthropic' && Deno.env.get('ANTHROPIC_API_KEY')) {
    return anthropic(modelId ?? 'claude-sonnet-4-20250514');
  }
  if (provider === 'google' && Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY')) {
    return google(modelId ?? 'gemini-2.0-flash');
  }
  if (provider === 'openai' && Deno.env.get('OPENAI_API_KEY')) {
    const openai = createOpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY')! });
    return openai(modelId ?? 'gpt-4o-mini');
  }
  if (provider === 'ollama') {
    const base = Deno.env.get('OLLAMA_BASE_URL') ?? 'http://host.docker.internal:11434/v1';
    const openai = createOpenAI({ baseURL: base, apiKey: 'ollama' });
    return openai(modelId ?? 'llava');
  }
  return null;
}

function pickField<T>(
  value: T | null | undefined,
  confidence: number | null | undefined,
): T | null {
  if (value == null) return null;
  if (confidence == null || confidence < CONFIDENCE) return null;
  return value;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405 });
  }

  const model = resolveModel();
  if (!model) {
    return new Response(JSON.stringify({ error: 'ai_not_configured' }), { status: 503 });
  }

  const auth = req.headers.get('authorization') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';

  const body = (await req.json()) as Body;
  if (!body.attachmentId || !Array.isArray(body.categories)) {
    return new Response(JSON.stringify({ error: 'invalid_body' }), { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'nido' },
  });

  const { data: row, error } = await admin
    .from('attachments')
    .select('id, space_id, storage_path, mime_type, ocr_status')
    .eq('id', body.attachmentId)
    .single();

  if (error || !row) {
    return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
  }

  if (row.mime_type === 'application/pdf') {
    return new Response(JSON.stringify({ ok: true, skipped: 'pdf' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const isService = auth === `Bearer ${serviceKey}`;
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

  await admin.from('attachments').update({ ocr_status: 'queued' }).eq('id', row.id);

  const { data: signed, error: signError } = await admin.storage
    .from('receipts')
    .createSignedUrl(row.storage_path, 120);
  if (signError || !signed?.signedUrl) {
    await admin.from('attachments').update({ ocr_status: 'failed' }).eq('id', row.id);
    return new Response(JSON.stringify({ error: signError?.message ?? 'signed_url_failed' }), {
      status: 500,
    });
  }

  const categoryNames = body.categories.map((c) => c.name);
  const categoryEnum =
    categoryNames.length > 0 ? z.enum(categoryNames as [string, ...string[]]) : z.string();

  const lineItemSchema = z.object({
    description: z.string().nullable(),
    amount_minor: z.number().int().nullable(),
    confidence: z.number().min(0).max(1).nullable(),
  });

  const schema = z.object({
    total_minor: z.number().int().nullable(),
    total_confidence: z.number().min(0).max(1).nullable(),
    currency: z.string().length(3).nullable(),
    currency_confidence: z.number().min(0).max(1).nullable(),
    booked_on: z.string().nullable(),
    date_confidence: z.number().min(0).max(1).nullable(),
    merchant: z.string().nullable(),
    merchant_confidence: z.number().min(0).max(1).nullable(),
    tax_minor: z.number().int().nullable(),
    tax_confidence: z.number().min(0).max(1).nullable(),
    category_name: categoryEnum.nullable(),
    category_confidence: z.number().min(0).max(1).nullable(),
    line_items: z.array(lineItemSchema).nullable(),
  });

  try {
    const { object } = await generateObject({
      model,
      schema,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: [
                'Extract structured data from this receipt image.',
                'Return amounts in minor units (cents).',
                'Use ISO-4217 currency codes.',
                'Use YYYY-MM-DD for dates.',
                categoryNames.length
                  ? `Pick category_name only from: ${categoryNames.join(', ')}.`
                  : 'Leave category_name empty.',
                'Provide a confidence score between 0 and 1 for each extracted field.',
              ].join(' '),
            },
            { type: 'image', image: signed.signedUrl },
          ],
        },
      ],
    });

    const categoryMatch = body.categories.find(
      (c) => c.name === pickField(object.category_name, object.category_confidence),
    );

    const lineItems = (object.line_items ?? [])
      .map((item) => ({
        description: pickField(item.description, item.confidence),
        amount_minor: pickField(item.amount_minor, item.confidence),
      }))
      .filter((item) => item.description != null || item.amount_minor != null);

    const result = {
      total_minor: pickField(object.total_minor, object.total_confidence),
      currency: pickField(object.currency, object.currency_confidence),
      booked_on: pickField(object.booked_on, object.date_confidence),
      merchant: pickField(object.merchant, object.merchant_confidence),
      tax_minor: pickField(object.tax_minor, object.tax_confidence),
      category_id: categoryMatch?.id ?? null,
      category_name: categoryMatch?.name ?? null,
      line_items: lineItems.length > 0 ? lineItems : null,
      raw: object,
    };

    await admin
      .from('attachments')
      .update({ ocr_status: 'done', ocr_result: result })
      .eq('id', row.id);

    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (extractError) {
    console.error('receipt-extract failed', extractError);
    await admin.from('attachments').update({ ocr_status: 'failed' }).eq('id', row.id);
    return new Response(JSON.stringify({ ok: false, error: 'extraction_failed' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
