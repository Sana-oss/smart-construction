import { describe, expect, it, vi } from 'vitest';
import type { FileStore } from '@/platform/supabase/storage';
import { deleteDocument, listDocumentsWithUrls, prepareDocumentUpload, saveDocument, type DocumentGateway } from './documents';

const P = '11111111-1111-4111-8111-111111111111';
const Q = '22222222-2222-4222-8222-222222222222';
const ID = '33333333-3333-4333-8333-333333333333';
const PDF = `${P}/documents/${ID}.pdf`;

function fakeStore(overrides: Partial<FileStore> = {}): FileStore {
  return {
    uploadTicket: vi.fn(async () => ({ token: 'tok' })),
    info: vi.fn(async () => ({ sizeBytes: 812_000, contentType: 'application/pdf' })),
    signedUrls: vi.fn(async (paths: string[]) => new Map(paths.map((p) => [p, `https://signed/${p}`]))),
    remove: vi.fn(async () => {}),
    ...overrides,
  };
}

function fakeGateway(overrides: Partial<DocumentGateway> = {}): DocumentGateway {
  return {
    listDocuments: vi.fn(async () => []),
    insertDocument: vi.fn(async () => ({ ok: true as const })),
    deleteDocument: vi.fn(async () => PDF),
    ...overrides,
  };
}

const details = { title: 'مخطط السقف المعتمد', kind: 'plan', version: '03' };

describe('prepareDocumentUpload', () => {
  it('picks a path with the extension of the type', async () => {
    const store = fakeStore();
    expect(await prepareDocumentUpload(store, P, 'application/pdf', () => ID)).toEqual({ ok: true, path: PDF, token: 'tok' });
    expect(store.uploadTicket).toHaveBeenCalledWith(PDF);
  });

  it('refuses a type that is not stored (Word, ...) before asking storage', async () => {
    const store = fakeStore();
    expect(await prepareDocumentUpload(store, P, 'application/msword', () => ID)).toEqual({ ok: false, reason: 'rejected' });
    expect(store.uploadTicket).not.toHaveBeenCalled();
  });
});

describe('saveDocument', () => {
  it('records the document with the stored size and type', async () => {
    const gateway = fakeGateway();
    expect(await saveDocument(gateway, fakeStore(), P, { storagePath: PDF, contentType: 'application/pdf', ...details })).toEqual({ ok: true });
    expect(gateway.insertDocument).toHaveBeenCalledWith({
      projectId: P,
      storagePath: PDF,
      contentType: 'application/pdf',
      sizeBytes: 812_000,
      title: 'مخطط السقف المعتمد',
      kind: 'plan',
      phaseId: null,
      version: '03',
    });
  });

  it("refuses another project's path, or a path whose extension does not match the type", async () => {
    const store = fakeStore();
    const other = await saveDocument(fakeGateway(), store, P, { storagePath: `${Q}/documents/${ID}.pdf`, contentType: 'application/pdf', ...details });
    expect(other).toEqual({ ok: false, kind: 'failed', reason: 'not_allowed' });
    const mismatch = await saveDocument(fakeGateway(), store, P, { storagePath: PDF, contentType: 'image/png', ...details });
    expect(mismatch).toEqual({ ok: false, kind: 'failed', reason: 'not_allowed' });
    expect(store.info).not.toHaveBeenCalled();
  });

  it('removes a stored file whose real type differs from what was declared', async () => {
    const store = fakeStore({ info: vi.fn(async () => ({ sizeBytes: 100, contentType: 'text/html' })) });
    const r = await saveDocument(fakeGateway(), store, P, { storagePath: PDF, contentType: 'application/pdf', ...details });
    expect(r).toEqual({ ok: false, kind: 'failed', reason: 'rejected' });
    expect(store.remove).toHaveBeenCalledWith([PDF]);
  });

  it('removes the file when the row is refused', async () => {
    const store = fakeStore();
    const gateway = fakeGateway({ insertDocument: vi.fn(async () => ({ ok: false as const, reason: 'unknown_reference' as const })) });
    const r = await saveDocument(gateway, store, P, { storagePath: PDF, contentType: 'application/pdf', ...details, phaseId: Q });
    expect(r).toEqual({ ok: false, kind: 'failed', reason: 'unknown_reference' });
    expect(store.remove).toHaveBeenCalledWith([PDF]);
  });

  it('refuses an invalid form AND removes the file the browser already uploaded (no file left without a row)', async () => {
    const store = fakeStore();
    const gateway = fakeGateway();
    const r = await saveDocument(gateway, store, P, { storagePath: PDF, contentType: 'application/pdf', title: '', kind: 'plan' });
    expect(r).toEqual({ ok: false, kind: 'invalid', errors: [{ field: 'title', code: 'required' }] });
    expect(store.remove).toHaveBeenCalledWith([PDF]);
    expect(gateway.insertDocument).not.toHaveBeenCalled();
  });

  it("never removes a file outside the project's folder, even with an invalid form", async () => {
    const store = fakeStore();
    await saveDocument(fakeGateway(), store, P, { storagePath: `${Q}/documents/${ID}.pdf`, contentType: 'application/pdf', title: '' });
    expect(store.remove).not.toHaveBeenCalled();
  });
});

describe('listDocumentsWithUrls and deleteDocument', () => {
  it('adds a 10-minute link to each document', async () => {
    const doc = {
      id: ID,
      title: 'مخطط',
      kind: 'plan' as const,
      phaseId: null,
      version: null,
      contentType: 'application/pdf' as const,
      sizeBytes: 10,
      storagePath: PDF,
      createdAt: '2026-11-18T10:00:00Z',
    };
    const store = fakeStore();
    expect(await listDocumentsWithUrls(fakeGateway({ listDocuments: vi.fn(async () => [doc]) }), store, P)).toEqual([
      { ...doc, url: `https://signed/${PDF}` },
    ]);
    expect(store.signedUrls).toHaveBeenCalledWith([PDF], 600);
  });

  it('deletes the row, then its file; leaves storage alone if the row stays', async () => {
    const store = fakeStore();
    expect(await deleteDocument(fakeGateway(), store, ID)).toEqual({ ok: true });
    expect(store.remove).toHaveBeenCalledWith([PDF]);
    const store2 = fakeStore();
    expect(await deleteDocument(fakeGateway({ deleteDocument: vi.fn(async () => null) }), store2, ID)).toEqual({ ok: false });
    expect(store2.remove).not.toHaveBeenCalled();
  });
});
