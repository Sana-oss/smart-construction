'use server';

// Server Actions for site photos (FR-DOC-02) and documents (FR-DOC-01). Run as the signed-in user: RLS and the storage policies decide what
// is allowed; the values are checked again by the domain rules.

import { revalidatePath } from 'next/cache';
import { isUuid, todayInTripoli } from '@/shared-kernel';
import { createServerSupabase } from '@/platform/supabase/server';
import { supabaseFileStore } from '@/platform/supabase/storage';
import { getMyProject } from '@/modules/projects';
import type { PhotoField } from '../domain/photo';
import { deletePhoto, preparePhotoUpload, savePhoto } from '../application/photos';
import { supabasePhotoGateway } from '../infra/supabase-photo-gateway';
import type { DocumentField } from '../domain/document';
import { deleteDocument, prepareDocumentUpload, saveDocument } from '../application/documents';
import { supabaseDocumentGateway } from '../infra/supabase-document-gateway';
import { documentErrorsAr, documentFailedAr, photoErrorsAr, photoFailedAr } from './messages.ar';
import { DOCUMENTS_PATH, PHOTOS_PATH } from './routes';

export type PrepareUploadResult = { ok: true; path: string; token: string } | { ok: false; message: string };

/** Step 1: a path in the owner's project folder and a one-time upload token for it. */
export async function preparePhotoUploadAction(): Promise<PrepareUploadResult> {
  const project = await getMyProject();
  if (!project) return { ok: false, message: photoFailedAr.not_allowed };
  const store = supabaseFileStore(await createServerSupabase());
  const r = await preparePhotoUpload(store, project.id, () => crypto.randomUUID());
  return r.ok ? r : { ok: false, message: photoFailedAr[r.reason] };
}

export interface SavePhotoState {
  ok?: boolean;
  formError?: string;
  fieldErrors?: Partial<Record<PhotoField, string>>;
}

/** Step 3: after the browser uploaded the file, check it and record the photo. */
export async function savePhotoAction(input: {
  storagePath: string;
  phaseId: string;
  takenOn: string;
  note: string;
}): Promise<SavePhotoState> {
  const project = await getMyProject();
  if (!project) return { formError: photoFailedAr.not_allowed };
  const supabase = await createServerSupabase();
  const r = await savePhoto(supabasePhotoGateway(supabase), supabaseFileStore(supabase), project.id, input, todayInTripoli());
  if (!r.ok) {
    if (r.kind === 'failed') return { formError: photoFailedAr[r.reason] };
    const fieldErrors: SavePhotoState['fieldErrors'] = {};
    for (const e of r.errors) fieldErrors[e.field] ??= photoErrorsAr[e.code];
    return { fieldErrors };
  }
  revalidatePath(PHOTOS_PATH);
  return { ok: true };
}

/** Bound by the page: `deletePhotoAction.bind(null, photoId)`. Deletes the row, then the file. */
export async function deletePhotoAction(photoId: string): Promise<void> {
  if (!isUuid(photoId)) return;
  const supabase = await createServerSupabase();
  await deletePhoto(supabasePhotoGateway(supabase), supabaseFileStore(supabase), photoId);
  revalidatePath(PHOTOS_PATH);
}

// ---------------------------------------------------------------------------------------------------------------
// Documents (FR-DOC-01): the same three steps as photos.

export async function prepareDocumentUploadAction(contentType: string): Promise<PrepareUploadResult> {
  const project = await getMyProject();
  if (!project) return { ok: false, message: documentFailedAr.not_allowed };
  const store = supabaseFileStore(await createServerSupabase());
  const r = await prepareDocumentUpload(store, project.id, contentType, () => crypto.randomUUID());
  return r.ok ? r : { ok: false, message: documentFailedAr[r.reason] };
}

export interface SaveDocumentState {
  ok?: boolean;
  formError?: string;
  fieldErrors?: Partial<Record<DocumentField, string>>;
}

export async function saveDocumentAction(input: {
  storagePath: string;
  contentType: string;
  title: string;
  kind: string;
  phaseId: string;
  version: string;
}): Promise<SaveDocumentState> {
  const project = await getMyProject();
  if (!project) return { formError: documentFailedAr.not_allowed };
  const supabase = await createServerSupabase();
  const r = await saveDocument(supabaseDocumentGateway(supabase), supabaseFileStore(supabase), project.id, input);
  if (!r.ok) {
    if (r.kind === 'failed') return { formError: documentFailedAr[r.reason] };
    const fieldErrors: SaveDocumentState['fieldErrors'] = {};
    for (const e of r.errors) fieldErrors[e.field] ??= documentErrorsAr[e.code];
    return { fieldErrors };
  }
  revalidatePath(DOCUMENTS_PATH);
  return { ok: true };
}

/** Bound by the page: `deleteDocumentAction.bind(null, documentId)`. Deletes the row, then the file. */
export async function deleteDocumentAction(documentId: string): Promise<void> {
  if (!isUuid(documentId)) return;
  const supabase = await createServerSupabase();
  await deleteDocument(supabaseDocumentGateway(supabase), supabaseFileStore(supabase), documentId);
  revalidatePath(DOCUMENTS_PATH);
}
