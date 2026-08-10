/**
 * Session refresh for `src/middleware.ts`. Runs on every matched request so an expiring
 * access token is rotated before a Server Component ever sees a stale JWT. Route protection
 * (redirecting signed-out users away from the app shell) arrives with real auth in Phase 01;
 * this only keeps the session alive. See docs/01-ARCHITECTURE.md §5.
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { clientEnv } from '@/lib/env';

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Revalidates the token with the Auth server; do not remove this call or replace it with
  // a decode of the local JWT, which would trust an already-expired or forged cookie.
  await supabase.auth.getUser();

  return response;
}
