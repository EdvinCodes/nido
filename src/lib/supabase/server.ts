/**
 * Server-side Supabase client for React Server Components and Server Actions. Reads and
 * writes the auth cookies via `next/headers`, so every server-rendered query runs with the
 * signed-in user's JWT and RLS applies exactly as it would for that user's own requests.
 *
 * Server Components cannot write cookies (Next.js throws), so `setAll` is wrapped in a
 * try/catch: the write is a no-op there, which is safe because `src/middleware.ts` already
 * refreshes the session cookie on every matched request. See docs/01-ARCHITECTURE.md §5.
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { clientEnv } from '@/lib/env';
import type { Database } from './database.types';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      // Application tables live in the `nido` schema, never `public`. See docs/01-ARCHITECTURE.md §3.
      db: { schema: 'nido' },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component render — middleware refreshes the session instead.
          }
        },
      },
    },
  );
}
