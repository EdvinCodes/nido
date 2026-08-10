/**
 * Session refresh plus route protection for `src/middleware.ts`. Runs on every matched
 * request so an expiring access token is rotated before a Server Component ever sees a
 * stale JWT, and so signed-out visitors never reach the authenticated app shell or
 * onboarding, while signed-in visitors are bounced away from the auth pages.
 * See docs/01-ARCHITECTURE.md §5.
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { clientEnv } from '@/lib/env';

const PROTECTED_PREFIXES = ['/s/', '/onboarding'];
const AUTH_ONLY_PATHS = new Set(['/sign-in', '/sign-up']);

function isProtectedPath(pathname: string): boolean {
  return (
    PROTECTED_PREFIXES.some(
      (prefix) => pathname === prefix.replace(/\/$/, '') || pathname.startsWith(prefix),
    ) || pathname === '/onboarding'
  );
}

/** Only ever redirect to a same-origin path, never an attacker-supplied absolute URL. */
function safeNext(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/';
  return next;
}

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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (isProtectedPath(pathname) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-in';
    const originalTarget = `${pathname}${request.nextUrl.search}`;
    url.search = '';
    url.searchParams.set('next', originalTarget);
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  }

  if (AUTH_ONLY_PATHS.has(pathname) && user) {
    const url = request.nextUrl.clone();
    url.pathname = safeNext(request.nextUrl.searchParams.get('next'));
    url.search = '';
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  }

  return response;
}
