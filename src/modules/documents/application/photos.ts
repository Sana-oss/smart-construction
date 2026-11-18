import type { FileStore } from '@/platform/supabase/storage';
import {
  isPhotoPathOf,
  PHOTO_MAX_STORED_BYTES,
  PHOTO_STORED_TYPE,
  PHOTO_URL_TTL_SECONDS,
  photoStoragePath,
  validatePhotoDetails,
  type PhotoDetails,
  type PhotoError,
} from '../domain/photo';

// Use cases: site photos (FR-DOC-02, design S31.1/S31.2). Run on the SERVER as the signed-in user.
// Upload in three steps, so the file never passes through our server (Vercel limits request size):
//   1. preparePhotoUpload: the server picks the path (in the owner's project folder) and gets a one-time upload token;
//      the storage policies refuse it unless the user may write to that project.
//   2. the browser uploads the compressed JPEG to that path with the token.
//   3. savePhoto: the server checks the file really is there, a JPEG, not too big, then records the row. If the row
//      is refused, the file is removed again.

export interface PhotoRecord {
  id: string;
  phaseId: string | null;
  takenOn: string;
  note: string | null;
  storagePath: string;
  /** ISO timestamp */
  createdAt: string;
}

export type PhotoFailure = 'not_allowed' | 'unknown_reference' | 'upload_missing' | 'rejected' | 'unavailable';

/** Port: the photos table. The Supabase adapter is infra/supabase-photo-gateway.ts. */
export interface PhotoGateway {
  /** The project's photos (any order; the domain groups and sorts them). */
  listPhotos(projectId: string): Promise<PhotoRecord[]>;
  insertPhoto(row: { projectId: string; storagePath: string; sizeBytes: number } & PhotoDetails): Promise<{ ok: true } | { ok: false; reason: PhotoFailure }>;
  /** Deletes the row and returns its file path, or null when it is not there or not allowed. */
  deletePhoto(photoId: string): Promise<string | null>;
}

export async function preparePhotoUpload(
  store: FileStore,
  projectId: string,
  newId: () => string,
): Promise<{ ok: true; path: string; token: string } | { ok: false; reason: PhotoFailure }> {
  const path = photoStoragePath(projectId, newId());
  const ticket = await store.uploadTicket(path);
  return ticket ? { ok: true, path, token: ticket.token } : { ok: false, reason: 'not_allowed' };
}

export type SavePhotoResult = { ok: true } | { ok: false; kind: 'invalid'; errors: PhotoError[] } | { ok: false; kind: 'failed'; reason: PhotoFailure };

export async function savePhoto(
  gateway: PhotoGateway,
  store: FileStore,
  projectId: string,
  input: { storagePath?: string | null; phaseId?: string | null; takenOn?: string | null; note?: string | null },
  today: string,
): Promise<SavePhotoResult> {
  const details = validatePhotoDetails(input, today);
  if (!details.ok) return { ok: false, kind: 'invalid', errors: details.errors };

  const path = input.storagePath ?? '';
  if (!isPhotoPathOf(projectId, path)) return { ok: false, kind: 'failed', reason: 'not_allowed' };

  const file = await store.info(path);
  if (!file) return { ok: false, kind: 'failed', reason: 'upload_missing' };
  if (file.contentType !== PHOTO_STORED_TYPE || file.sizeBytes > PHOTO_MAX_STORED_BYTES) {
    await store.remove([path]);
    return { ok: false, kind: 'failed', reason: 'rejected' };
  }

  const saved = await gateway.insertPhoto({ projectId, storagePath: path, sizeBytes: file.sizeBytes, ...details.value });
  if (!saved.ok) {
    await store.remove([path]); // no row = no file left behind
    return { ok: false, kind: 'failed', reason: saved.reason };
  }
  return { ok: true };
}

export interface PhotoWithUrl extends PhotoRecord {
  /** Short-lived link (PHOTO_URL_TTL_SECONDS); null when the link could not be made. */
  url: string | null;
}

export async function listPhotosWithUrls(gateway: PhotoGateway, store: FileStore, projectId: string): Promise<PhotoWithUrl[]> {
  const photos = await gateway.listPhotos(projectId);
  const urls = await store.signedUrls(photos.map((p) => p.storagePath), PHOTO_URL_TTL_SECONDS);
  return photos.map((p) => ({ ...p, url: urls.get(p.storagePath) ?? null }));
}

export async function deletePhoto(gateway: PhotoGateway, store: FileStore, photoId: string): Promise<{ ok: boolean }> {
  const path = await gateway.deletePhoto(photoId);
  if (path === null) return { ok: false };
  await store.remove([path]);
  return { ok: true };
}
