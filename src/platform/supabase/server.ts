import { cache } from 'react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { publicEnv } from '../env';

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * It acts AS THE SIGNED-IN USER (publishable key + the user's session cookie), so every query goes
 * through RLS. The service-role key is never used here (architecture rule R7/R8, NFR-SEC-01).
 *
 * One client per request, never shared between requests. React's cache() does exactly that for a page:
 * the home page asks "who is signed in?", "which project?" and "how much was spent?", and without cache()
 * each question built its own client and checked the session again. cache() keeps the result only while ONE
 * request is being rendered; the next request (another user, another cookie) always gets a new client.
 */
export const createServerSupabase = cache(async () => {
  const cookieStore = await cookies();
  const { supabaseUrl, supabaseKey } = publicEnv();

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, which cannot write cookies. Safe to ignore:
          // src/proxy.ts refreshes the session cookie on every request.
        }
      },
    },
  });
});
