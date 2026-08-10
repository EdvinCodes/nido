/**
 * Service-role Supabase client. Bypasses Row Level Security entirely, so it exists only for
 * Edge Functions, admin scripts, and trusted server-only code paths that must act across
 * spaces (e.g. the health check, webhook handlers). Never import this from a Server
 * Component that renders user-scoped data — use `./server.ts` so RLS still applies.
 *
 * The runtime guard throws if this module is ever evaluated in a browser bundle, matching
 * the pattern in `@/lib/env`'s `getServerEnv`. See docs/01-ARCHITECTURE.md §9.
 */

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { clientEnv, getServerEnv } from '@/lib/env';
import type { Database } from './database.types';

let cachedAdminClient: SupabaseClient<Database> | undefined;

export function createAdminClient(): SupabaseClient<Database> {
  if (typeof window !== 'undefined') {
    throw new Error(
      'Nido — createAdminClient() was called from the browser. The service role key never leaves the server.',
    );
  }

  if (cachedAdminClient) return cachedAdminClient;

  const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
  cachedAdminClient = createSupabaseClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      // Application tables live in the `nido` schema, never `public`. See docs/01-ARCHITECTURE.md §3.
      db: { schema: 'nido' },
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
  return cachedAdminClient;
}
