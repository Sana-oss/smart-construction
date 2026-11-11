import { createBrowserClient } from '@supabase/ssr';
import { publicEnv } from '../env';

/** Supabase client for Client Components (runs in the browser, as the signed-in user, under RLS). */
export function createBrowserSupabase() {
  const { supabaseUrl, supabaseKey } = publicEnv();
  return createBrowserClient(supabaseUrl, supabaseKey);
}
