/**
 * Environment variable validation. Parsed once at module load so a missing or malformed
 * variable fails immediately with a readable message instead of surfacing as a confusing
 * runtime error three files away. See docs/01-ARCHITECTURE.md §9.
 */

import { z } from 'zod';

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.url(),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  AI_PROVIDER: z.enum(['openai', 'anthropic', 'google', 'ollama']).optional(),
  AI_MODEL: z.string().optional(),
  AI_DAILY_MESSAGE_LIMIT: z.coerce.number().int().min(1).max(500).optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  OLLAMA_BASE_URL: z.url().optional(),
  FX_API_URL: z.url().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
  BANK_PROVIDER: z.enum(['enablebanking', 'none']).optional(),
  BANK_APP_ID: z.string().optional(),
  BANK_PRIVATE_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

function formatIssues(error: z.ZodError): string {
  const lines = error.issues.map(
    (issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`,
  );
  return ['Nido — invalid or missing environment variables:', ...lines].join('\n');
}

function parseClientEnv(): z.infer<typeof clientSchema> {
  const result = clientSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });

  if (!result.success) {
    throw new Error(formatIssues(result.error));
  }

  return result.data;
}

function parseServerEnv(): z.infer<typeof serverSchema> {
  const result = serverSchema.safeParse(process.env);

  if (!result.success) {
    throw new Error(formatIssues(result.error));
  }

  if (result.data.NODE_ENV === 'production' && !result.data.CRON_SECRET) {
    throw new Error(
      'Nido — CRON_SECRET is required in production to authenticate scheduled Edge Function calls.',
    );
  }

  return result.data;
}

/** Safe to import anywhere, including client components: only `NEXT_PUBLIC_*` values. */
export const clientEnv = parseClientEnv();

let cachedServerEnv: z.infer<typeof serverSchema> | undefined;

/**
 * Server-only configuration. Throws if evaluated in a browser bundle, so an accidental
 * client import fails loudly instead of silently returning undefined secrets.
 */
export function getServerEnv(): z.infer<typeof serverSchema> {
  if (typeof window !== 'undefined') {
    throw new Error(
      'Nido — getServerEnv() was called from the browser. Server configuration never leaves the server.',
    );
  }

  cachedServerEnv ??= parseServerEnv();
  return cachedServerEnv;
}
