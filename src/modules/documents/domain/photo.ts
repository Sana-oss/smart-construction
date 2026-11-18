import { isIsoDate, isUuid } from '@/shared-kernel';

// Site photos (FR-DOC-02, design S31.1/S31.2; plan approved 18 Nov 2026). Pure: no React, no database, no browser.
// The numbers below are PRODUCT choices (how big a stored photo is), not engineering values; recorded in the change
// register and easy to change.

/** Longest side of a stored photo, in pixels. Sharp on a phone and a laptop, a few hundred KB as JPEG. */
export const PHOTO_MAX_EDGE = 1600;
/** JPEG quality used when re-encoding (0–1). */
export const PHOTO_JPEG_QUALITY = 0.8;
/** Largest file the owner may pick before compression (a phone's original photo). */
export const PHOTO_MAX_INPUT_BYTES = 30 * 1024 * 1024;
/** Largest stored photo after compression. The storage bucket refuses anything bigger (0013). */
export const PHOTO_MAX_STORED_BYTES = 5 * 1024 * 1024;
/** Every stored photo is a JPEG, whatever was picked (HEIC, PNG, WebP are converted in the browser). */
export const PHOTO_STORED_TYPE = 'image/jpeg';
export const PHOTO_NOTE_MAX = 500;

/**
 * The size to draw the photo at: scaled down so its longest side is at most `maxEdge`, keeping its proportions.
 * Never scaled UP (a small photo stays as it is).
 */
export function fitWithin(width: number, height: number, maxEdge: number = PHOTO_MAX_EDGE): { width: number; height: number } {
  if (!(width > 0 && height > 0)) throw new Error('fitWithin needs a positive width and height');
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * Where a project's photo is stored in the bucket. The first folder is the project id: the storage policies of
 * 0013 decide access from it (member reads, writer uploads and deletes).
 */
export function photoStoragePath(projectId: string, photoId: string): string {
  if (!isUuid(projectId) || !isUuid(photoId)) throw new Error('photoStoragePath needs two uuids');
  return `${projectId}/photos/${photoId}.jpg`;
}

/** True only for a path made by photoStoragePath for THIS project (a browser could send any path). */
export function isPhotoPathOf(projectId: string, path: string): boolean {
  const m = /^([0-9a-f-]{36})\/photos\/([0-9a-f-]{36})\.jpg$/.exec(path);
  return m !== null && m[1] === projectId && isUuid(m[1]) && isUuid(m[2]);
}

export type PhotoField = 'phaseId' | 'takenOn' | 'note' | 'file';
export type PhotoErrorCode = 'invalid_id' | 'invalid_date' | 'date_in_future' | 'too_long' | 'too_large' | 'not_an_image';
export interface PhotoError {
  field: PhotoField;
  code: PhotoErrorCode;
}

export interface PhotoDetails {
  phaseId: string | null;
  /** "YYYY-MM-DD" */
  takenOn: string;
  note: string | null;
}

export type PhotoDetailsResult = { ok: true; value: PhotoDetails } | { ok: false; errors: PhotoError[] };

/**
 * The words of the photo form (S31.2): phase optional, date (empty = today, never after today), note optional.
 * @param today the date in Libya, "YYYY-MM-DD".
 */
export function validatePhotoDetails(
  input: { phaseId?: string | null; takenOn?: string | null; note?: string | null },
  today: string,
): PhotoDetailsResult {
  const errors: PhotoError[] = [];
  const phaseId = (input.phaseId ?? '').trim() || null;
  if (phaseId !== null && !isUuid(phaseId)) errors.push({ field: 'phaseId', code: 'invalid_id' });

  const takenOn = (input.takenOn ?? '').trim() || today;
  if (!isIsoDate(takenOn)) errors.push({ field: 'takenOn', code: 'invalid_date' });
  else if (takenOn > today) errors.push({ field: 'takenOn', code: 'date_in_future' });

  const note = (input.note ?? '').trim() || null;
  if (note !== null && [...note].length > PHOTO_NOTE_MAX) errors.push({ field: 'note', code: 'too_long' });

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: { phaseId, takenOn, note } };
}

/** The picked file, before compression: an image, not bigger than PHOTO_MAX_INPUT_BYTES. */
export function checkPickedFile(file: { size: number; type: string; name: string }): PhotoError | null {
  const looksLikeImage = file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name);
  if (!looksLikeImage) return { field: 'file', code: 'not_an_image' };
  if (file.size > PHOTO_MAX_INPUT_BYTES) return { field: 'file', code: 'too_large' };
  return null;
}

/** HEIC/HEIF (iPhone photos). Some browsers report an empty type for them, so the name is checked too. */
export function isHeicFile(file: { type: string; name: string }): boolean {
  return /^image\/hei[cf](-sequence)?$/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
}

/** How long a link to view a photo works (NFR-SEC-03: short-lived; an old link stops working). */
export const PHOTO_URL_TTL_SECONDS = 10 * 60;

export interface PhotoGroup<P> {
  /** null = photos not linked to any phase */
  phaseId: string | null;
  photos: P[];
  /** The most recent photo date in the group, "YYYY-MM-DD". */
  latest: string;
}

/**
 * Design S31.1 «صور الموقع»: photos grouped by phase, phases in their plan order, photos newest first, and photos
 * without a phase last. Phases with no photos are left out.
 */
export function groupPhotosByPhase<P extends { phaseId: string | null; takenOn: string; createdAt: string }>(
  photos: readonly P[],
  phases: readonly { id: string; position: number }[],
): PhotoGroup<P>[] {
  const order = new Map(phases.map((p) => [p.id, p.position]));
  const groups = new Map<string | null, P[]>();
  for (const photo of photos) {
    const key = photo.phaseId !== null && order.has(photo.phaseId) ? photo.phaseId : null;
    groups.set(key, [...(groups.get(key) ?? []), photo]);
  }
  const newestFirst = (a: P, b: P) => b.takenOn.localeCompare(a.takenOn) || b.createdAt.localeCompare(a.createdAt);
  return [...groups.entries()]
    .map(([phaseId, list]) => {
      const sorted = [...list].sort(newestFirst);
      return { phaseId, photos: sorted, latest: sorted[0].takenOn };
    })
    .sort((a, b) => (a.phaseId === null ? 1 : b.phaseId === null ? -1 : order.get(a.phaseId)! - order.get(b.phaseId)!));
}
