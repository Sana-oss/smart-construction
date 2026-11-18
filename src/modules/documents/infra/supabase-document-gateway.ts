import type { SupabaseClient } from '@supabase/supabase-js';
import type { DocumentFailure, DocumentGateway, DocumentRecord } from '../application/documents';
import { isDocumentKind, isDocumentType } from '../domain/document';

// Supabase adapter for the documents table. Always used with the signed-in user's client: RLS decides what is visible
// and writable, and the 0014 checks and guard keep each document's path and phase inside its project.

interface DocumentRow {
  id: string;
  title: string;
  kind: string;
  phase_id: string | null;
  version: string | null;
  content_type: string;
  size_bytes: number;
  storage_path: string;
  created_at: string;
}

/** 42501 RLS refused · 23503 phase of another project (guard) · 23514/23505 bad or duplicate value */
export function mapDocumentError(error: { code?: string }): DocumentFailure {
  switch (error.code) {
    case '42501':
      return 'not_allowed';
    case '23503':
      return 'unknown_reference';
    case '23514':
    case '23505':
      return 'rejected';
    default:
      return 'unavailable';
  }
}

/** Row -> record. A row the database could not have produced (unknown kind or type) is skipped, not guessed. */
export function toDocumentRecord(r: DocumentRow): DocumentRecord | null {
  if (!isDocumentKind(r.kind) || !isDocumentType(r.content_type)) return null;
  return {
    id: r.id,
    title: r.title,
    kind: r.kind,
    phaseId: r.phase_id,
    version: r.version,
    contentType: r.content_type,
    sizeBytes: Number(r.size_bytes),
    storagePath: r.storage_path,
    createdAt: r.created_at,
  };
}

export function supabaseDocumentGateway(supabase: SupabaseClient): DocumentGateway {
  return {
    async listDocuments(projectId) {
      const { data, error } = await supabase
        .from('documents')
        .select('id, title, kind, phase_id, version, content_type, size_bytes, storage_path, created_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .returns<DocumentRow[]>();
      if (error) throw new Error(`documents unavailable: ${error.message}`);
      return (data ?? []).map(toDocumentRecord).filter((d): d is DocumentRecord => d !== null);
    },

    async insertDocument(d) {
      const { error } = await supabase.from('documents').insert({
        project_id: d.projectId,
        title: d.title,
        kind: d.kind,
        phase_id: d.phaseId,
        version: d.version,
        content_type: d.contentType,
        size_bytes: d.sizeBytes,
        storage_path: d.storagePath,
      });
      return error ? { ok: false, reason: mapDocumentError(error) } : { ok: true };
    },

    async deleteDocument(documentId) {
      const { data, error } = await supabase.from('documents').delete().eq('id', documentId).select('storage_path');
      if (error || !data || data.length !== 1) return null;
      return String(data[0].storage_path);
    },
  };
}
