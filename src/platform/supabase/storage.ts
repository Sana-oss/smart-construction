import type { SupabaseClient } from '@supabase/supabase-js';

// Private file storage (NFR-SEC-03; bucket and policies in migration 0013). In platform, not in a module, because
// more than one module stores files (documents now, finance's receipt photo later) and modules of the same level
// may not import each other (rule R2). Always used with the SIGNED-IN user's client: the storage policies decide
// (member reads, writer uploads and deletes, by the project id that starts every path).

export const PROJECT_FILES_BUCKET = 'project-files';

export interface FileStore {
  /** A one-time token to upload exactly this path from the browser. Refused unless the user may write there. */
  uploadTicket(path: string): Promise<{ token: string } | null>;
  /** Size and type of a stored file, or null when it is not there (or not visible to this user). */
  info(path: string): Promise<{ sizeBytes: number; contentType: string } | null>;
  /** Short-lived links to read files. Paths the user may not read are missing from the result. */
  signedUrls(paths: string[], expiresInSeconds: number): Promise<Map<string, string>>;
  remove(paths: string[]): Promise<void>;
}

export function supabaseFileStore(supabase: SupabaseClient): FileStore {
  const bucket = () => supabase.storage.from(PROJECT_FILES_BUCKET);
  return {
    async uploadTicket(path) {
      const { data, error } = await bucket().createSignedUploadUrl(path);
      return error || !data ? null : { token: data.token };
    },

    async info(path) {
      const { data, error } = await bucket().info(path);
      if (error || !data) return null;
      const size = Number(data.size ?? data.metadata?.size);
      const type = String(data.contentType ?? data.metadata?.mimetype ?? '');
      return Number.isFinite(size) && size > 0 ? { sizeBytes: size, contentType: type } : null;
    },

    async signedUrls(paths, expiresInSeconds) {
      const out = new Map<string, string>();
      if (paths.length === 0) return out;
      const { data, error } = await bucket().createSignedUrls(paths, expiresInSeconds);
      if (error || !data) return out;
      for (const item of data) if (item.path && item.signedUrl && !item.error) out.set(item.path, item.signedUrl);
      return out;
    },

    async remove(paths) {
      if (paths.length > 0) await bucket().remove(paths);
    },
  };
}
