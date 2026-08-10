/**
 * Browser Supabase client. Use from Client Components only — anything that runs on the
 * server (Server Components, Server Actions, route handlers) goes through `./server.ts`
 * instead, so cookies are always read and written correctly. See docs/01-ARCHITECTURE.md §5.
 */

import { createBrowserClient } from '@supabase/ssr';
import { clientEnv } from '@/lib/env';
import type { Database } from './database.types';

export function createClient() {
  return createBrowserClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    // Application tables live in the `nido` schema, never `public`. See docs/01-ARCHITECTURE.md §3.
    { db: { schema: 'nido' } },
  );
}
