import { checkPickedImage, isIsoDate, isUuid } from '@/shared-kernel';

// Site photos (FR-DOC-02, design S31.1/S31.2; plan approved 18 Nov 2026). Pure: no React, no database, no browser.
// The numbers below are PRODUCT choices (how big a stored photo is), not engineering values; recorded in the change
// register and easy to change.

// Stored-image rules shared with other modules (shared-kernel/images.ts), under this module's names.
export {
  IMAGE_MAX_EDGE as PHOTO_MAX_EDGE,
  IMAGE_JPEG_QUALITY as PHOTO_JPEG_QUALITY,
  IMAGE_MAX_INPUT_BYTES as PHOTO_MAX_INPUT_BYTES,
  IMAGE_MAX_STORED_BYTES as PHOTO_MAX_STORED_BYTES,
  IMAGE_STORED_TYPE as PHOTO_STORED_TYPE,
  fitWithin,
  isHeicFile,
} from '@/shared-kernel';
export const PHOTO_NOTE_MAX = 500;

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
  const problem = checkPickedImage(file);
  return problem ? { field: 'file', code: problem } : null;
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
