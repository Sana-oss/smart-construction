import type { SupabaseClient } from '@supabase/supabase-js';
import type { PhotoFailure, PhotoGateway, PhotoRecord } from '../application/photos';

// Supabase adapter for the photos table. Always used with the signed-in user's client: RLS decides what is visible
// and writable, and the 0013 guard keeps each photo's phase and path inside its project.

interface PhotoRow {
  id: string;
  phase_id: string | null;
  taken_on: string;
  note: string | null;
  storage_path: string;
  created_at: string;
}

/** 42501 RLS refused · 23503 phase of another project (guard) · 23514/23505/22007 bad or duplicate value */
export function mapPhotoError(error: { code?: string }): PhotoFailure {
  switch (error.code) {
    case '42501':
      return 'not_allowed';
    case '23503':
      return 'unknown_reference';
    case '23514':
    case '23505':
    case '22007':
      return 'rejected';
    default:
      return 'unavailable';
  }
}

export const toPhotoRecord = (r: PhotoRow): PhotoRecord => ({
  id: r.id,
  phaseId: r.phase_id,
  takenOn: r.taken_on,
  note: r.note,
  storagePath: r.storage_path,
  createdAt: r.created_at,
});

export function supabasePhotoGateway(supabase: SupabaseClient): PhotoGateway {
  return {
    async listPhotos(projectId) {
      const { data, error } = await supabase
        .from('photos')
        .select('id, phase_id, taken_on, note, storage_path, created_at')
        .eq('project_id', projectId)
        .order('taken_on', { ascending: false })
        .returns<PhotoRow[]>();
      if (error) throw new Error(`photos unavailable: ${error.message}`);
      return (data ?? []).map(toPhotoRecord);
    },

    async insertPhoto(p) {
      const { error } = await supabase.from('photos').insert({
        project_id: p.projectId,
        phase_id: p.phaseId,
        storage_path: p.storagePath,
        size_bytes: p.sizeBytes,
        taken_on: p.takenOn,
        note: p.note,
      });
      return error ? { ok: false, reason: mapPhotoError(error) } : { ok: true };
    },

    async deletePhoto(photoId) {
      // RLS turns a refused delete into "0 rows", so the deleted row is read back to know it happened.
      const { data, error } = await supabase.from('photos').delete().eq('id', photoId).select('storage_path');
      if (error || !data || data.length !== 1) return null;
      return String(data[0].storage_path);
    },
  };
}
