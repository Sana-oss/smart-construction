import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { publicEnv } from '../env';

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * It acts AS THE SIGNED-IN USER (publishable key + the user's session cookie), so every query goes
 * through RLS. The service-role key is never used here (architecture rule R7/R8, NFR-SEC-01).
 * Create one per request; never share it between requests.
 */
export async function createServerSupabase() {
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
}
