// Who is signed in, for Server Components (pages). Server-only: it reads the session cookie.
// getClaims() verifies the access token (Supabase docs: use getClaims, not getSession, to trust identity).
// This only decides what to SHOW; data access is still enforced by RLS in the database.

import { createServerSupabase } from '@/platform/supabase/server';

export async function getSignedInUserId(): Promise<string | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return data.claims.sub;
}
