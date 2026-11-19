// Who is signed in, for Server Components (pages). Server-only: it reads the session cookie.
// getClaims() verifies the access token (Supabase docs: use getClaims, not getSession, to trust identity).
// This only decides what to SHOW; data access is still enforced by RLS in the database.

import { cache } from 'react';
import { createServerSupabase } from '@/platform/supabase/server';
import { firstName } from '../domain/display-name';

// cache(): a layout and its page both ask this question; the token is verified once per request, not twice.
// The answer is never kept between requests.
export const getSignedInUserId = cache(async (): Promise<string | null> => {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return data.claims.sub;
});

/**
 * The signed-in owner's first name, for greetings (design S07.1 «مرحبًا محمد»), or null. Reads only full_name from
 * the owner's own profile row (policy own_profile); the identity document columns are never selected.
 */
export const getMyFirstName = cache(async (): Promise<string | null> => {
  const userId = await getSignedInUserId();
  if (!userId) return null;
  const supabase = await createServerSupabase();
  const { data } = await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle<{ full_name: string | null }>();
  return firstName(data?.full_name);
});
