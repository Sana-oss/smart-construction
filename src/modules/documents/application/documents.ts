import type { FileStore } from '@/platform/supabase/storage';
import {
  DOCUMENT_MAX_BYTES,
  documentStoragePath,
  isDocumentPathOf,
  isDocumentType,
  validateDocumentDetails,
  type DocumentDetails,
  type DocumentError,
  type DocumentKind,
  type DocumentType,
} from '../domain/document';

// Use cases: project documents (FR-DOC-01, design S30.1/S30.2/S10.4). Same three-step upload as photos
// (application/photos.ts): the server picks the path and gets a one-time token, the browser uploads, then the server
// checks the stored file and records the row (removing the file again if the row is refused).

export interface DocumentRecord {
  id: string;
  title: string;
  kind: DocumentKind;
  phaseId: string | null;
  version: string | null;
  contentType: DocumentType;
  sizeBytes: number;
  storagePath: string;
  /** ISO timestamp */
  createdAt: string;
}

export type DocumentFailure = 'not_allowed' | 'unknown_reference' | 'upload_missing' | 'rejected' | 'unavailable';

/** Port: the documents table. The Supabase adapter is infra/supabase-document-gateway.ts. */
export interface DocumentGateway {
  /** The project's documents, newest first. */
  listDocuments(projectId: string): Promise<DocumentRecord[]>;
  insertDocument(
    row: { projectId: string; storagePath: string; contentType: DocumentType; sizeBytes: number } & DocumentDetails,
  ): Promise<{ ok: true } | { ok: false; reason: DocumentFailure }>;
  /** Deletes the row and returns its file path, or null when it is not there or not allowed. */
  deleteDocument(documentId: string): Promise<string | null>;
}

/** How long a link to open a document works (NFR-SEC-03; plan of 18 Nov). */
export const DOCUMENT_URL_TTL_SECONDS = 10 * 60;

export async function prepareDocumentUpload(
  store: FileStore,
  projectId: string,
  contentType: unknown,
  newId: () => string,
): Promise<{ ok: true; path: string; token: string } | { ok: false; reason: DocumentFailure }> {
  if (!isDocumentType(contentType)) return { ok: false, reason: 'rejected' };
  const path = documentStoragePath(projectId, newId(), contentType);
  const ticket = await store.uploadTicket(path);
  return ticket ? { ok: true, path, token: ticket.token } : { ok: false, reason: 'not_allowed' };
}

export type SaveDocumentResult =
  | { ok: true }
  | { ok: false; kind: 'invalid'; errors: DocumentError[] }
  | { ok: false; kind: 'failed'; reason: DocumentFailure };

export async function saveDocument(
  gateway: DocumentGateway,
  store: FileStore,
  projectId: string,
  input: {
    storagePath?: string | null;
    contentType?: string | null;
    title?: string | null;
    kind?: string | null;
    phaseId?: string | null;
    version?: string | null;
  },
): Promise<SaveDocumentResult> {
  const type = input.contentType;
  const path = input.storagePath ?? '';
  const ownPath = isDocumentType(type) && isDocumentPathOf(projectId, path, type);

  const details = validateDocumentDetails(input);
  if (!details.ok) {
    // The browser uploads BEFORE this check: remove that file, or it stays in storage without a row.
    // Only a path inside this project's folder is ever removed.
    if (ownPath) await store.remove([path]);
    return { ok: false, kind: 'invalid', errors: details.errors };
  }
  if (!ownPath || !isDocumentType(type)) return { ok: false, kind: 'failed', reason: 'not_allowed' };

  const file = await store.info(path);
  if (!file) return { ok: false, kind: 'failed', reason: 'upload_missing' };
  if (file.contentType !== type || file.sizeBytes > DOCUMENT_MAX_BYTES) {
    await store.remove([path]);
    return { ok: false, kind: 'failed', reason: 'rejected' };
  }

  const saved = await gateway.insertDocument({ projectId, storagePath: path, contentType: type, sizeBytes: file.sizeBytes, ...details.value });
  if (!saved.ok) {
    await store.remove([path]);
    return { ok: false, kind: 'failed', reason: saved.reason };
  }
  return { ok: true };
}

export interface DocumentWithUrl extends DocumentRecord {
  /** Short-lived link (DOCUMENT_URL_TTL_SECONDS); null when the link could not be made. */
  url: string | null;
}

export async function listDocumentsWithUrls(gateway: DocumentGateway, store: FileStore, projectId: string): Promise<DocumentWithUrl[]> {
  const docs = await gateway.listDocuments(projectId);
  const urls = await store.signedUrls(docs.map((d) => d.storagePath), DOCUMENT_URL_TTL_SECONDS);
  return docs.map((d) => ({ ...d, url: urls.get(d.storagePath) ?? null }));
}

export async function deleteDocument(gateway: DocumentGateway, store: FileStore, documentId: string): Promise<{ ok: boolean }> {
  const path = await gateway.deleteDocument(documentId);
  if (path === null) return { ok: false };
  await store.remove([path]);
  return { ok: true };
}
