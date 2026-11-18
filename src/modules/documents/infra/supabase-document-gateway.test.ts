import { describe, expect, it } from 'vitest';
import { mapDocumentError, toDocumentRecord } from './supabase-document-gateway';

const row = {
  id: 'd1',
  title: 'مخطط السقف',
  kind: 'plan',
  phase_id: null,
  version: '03',
  content_type: 'application/pdf',
  size_bytes: 812000,
  storage_path: 'p/documents/d1.pdf',
  created_at: '2026-11-18T10:00:00Z',
};

describe('document gateway mapping', () => {
  it('maps a row', () => {
    expect(toDocumentRecord(row)).toEqual({
      id: 'd1',
      title: 'مخطط السقف',
      kind: 'plan',
      phaseId: null,
      version: '03',
      contentType: 'application/pdf',
      sizeBytes: 812000,
      storagePath: 'p/documents/d1.pdf',
      createdAt: '2026-11-18T10:00:00Z',
    });
  });

  it('skips a row with an unknown kind or type instead of guessing', () => {
    expect(toDocumentRecord({ ...row, kind: 'x' })).toBeNull();
    expect(toDocumentRecord({ ...row, content_type: 'text/html' })).toBeNull();
  });

  it('turns database codes into our reasons', () => {
    expect(mapDocumentError({ code: '42501' })).toBe('not_allowed');
    expect(mapDocumentError({ code: '23503' })).toBe('unknown_reference');
    expect(mapDocumentError({ code: '23514' })).toBe('rejected');
    expect(mapDocumentError({})).toBe('unavailable');
  });
});
