// Reads for Server Components (pages). Server-only: uses the signed-in user's session cookie (RLS applies).

import { createServerSupabase } from '@/platform/supabase/server';
import { supabaseFileStore } from '@/platform/supabase/storage';
import { listPhotosWithUrls, type PhotoWithUrl } from '../application/photos';
import { supabasePhotoGateway } from '../infra/supabase-photo-gateway';

/** The project's photos, each with a short-lived link (NFR-SEC-03). */
export async function getProjectPhotos(projectId: string): Promise<PhotoWithUrl[]> {
  const supabase = await createServerSupabase();
  return listPhotosWithUrls(supabasePhotoGateway(supabase), supabaseFileStore(supabase), projectId);
}
