import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { publicEnv } from '../env';

/**
 * Refreshes the user's session on every request (called from src/proxy.ts).
 * Server Components cannot write cookies, so an expired access token must be refreshed here,
 * then passed both to the Server Components (request cookies) and to the browser (response cookies).
 * Pattern from the Supabase "Server-Side Auth for Next.js" guide.
 */
export async function refreshSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { supabaseUrl, supabaseKey } = publicEnv();

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        // Cache-control headers from Supabase stop a CDN from caching a response that carries a session.
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Keep this call directly after createServerClient: it validates the token and triggers the refresh.
  // Removing it makes users get signed out at random.
  await supabase.auth.getClaims();

  return response;
}
