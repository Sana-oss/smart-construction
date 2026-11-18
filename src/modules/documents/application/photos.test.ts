import { describe, expect, it, vi } from 'vitest';
import type { FileStore } from '@/platform/supabase/storage';
import { deletePhoto, listPhotosWithUrls, preparePhotoUpload, savePhoto, type PhotoGateway } from './photos';

const P = '11111111-1111-4111-8111-111111111111';
const Q = '22222222-2222-4222-8222-222222222222';
const ID = '33333333-3333-4333-8333-333333333333';
const PATH = `${P}/photos/${ID}.jpg`;
const TODAY = '2026-11-18';

function fakeStore(overrides: Partial<FileStore> = {}): FileStore {
  return {
    uploadTicket: vi.fn(async () => ({ token: 'tok' })),
    info: vi.fn(async () => ({ sizeBytes: 240_000, contentType: 'image/jpeg' })),
    signedUrls: vi.fn(async (paths: string[]) => new Map(paths.map((p) => [p, `https://signed/${p}`]))),
    remove: vi.fn(async () => {}),
    ...overrides,
  };
}

function fakeGateway(overrides: Partial<PhotoGateway> = {}): PhotoGateway {
  return {
    listPhotos: vi.fn(async () => []),
    insertPhoto: vi.fn(async () => ({ ok: true as const })),
    deletePhoto: vi.fn(async () => PATH),
    ...overrides,
  };
}

describe('preparePhotoUpload', () => {
  it("picks the path in the project's folder and asks for an upload token", async () => {
    const store = fakeStore();
    expect(await preparePhotoUpload(store, P, () => ID)).toEqual({ ok: true, path: PATH, token: 'tok' });
    expect(store.uploadTicket).toHaveBeenCalledWith(PATH);
  });

  it('reports a refusal from the storage policies', async () => {
    const store = fakeStore({ uploadTicket: vi.fn(async () => null) });
    expect(await preparePhotoUpload(store, P, () => ID)).toEqual({ ok: false, reason: 'not_allowed' });
  });
});

describe('savePhoto', () => {
  it('records the photo with the size of the stored file', async () => {
    const gateway = fakeGateway();
    const r = await savePhoto(gateway, fakeStore(), P, { storagePath: PATH, note: ' تسليح ' }, TODAY);
    expect(r).toEqual({ ok: true });
    expect(gateway.insertPhoto).toHaveBeenCalledWith({
      projectId: P,
      storagePath: PATH,
      sizeBytes: 240_000,
      phaseId: null,
      takenOn: TODAY,
      note: 'تسليح',
    });
  });

  it("refuses a path in another project's folder without touching storage", async () => {
    const store = fakeStore();
    const r = await savePhoto(fakeGateway(), store, P, { storagePath: `${Q}/photos/${ID}.jpg` }, TODAY);
    expect(r).toEqual({ ok: false, kind: 'failed', reason: 'not_allowed' });
    expect(store.info).not.toHaveBeenCalled();
  });

  it('reports a file that never arrived', async () => {
    const r = await savePhoto(fakeGateway(), fakeStore({ info: vi.fn(async () => null) }), P, { storagePath: PATH }, TODAY);
    expect(r).toEqual({ ok: false, kind: 'failed', reason: 'upload_missing' });
  });

  it('removes a stored file that is not a JPEG or too big', async () => {
    const store = fakeStore({ info: vi.fn(async () => ({ sizeBytes: 9_000_000, contentType: 'image/jpeg' })) });
    const r = await savePhoto(fakeGateway(), store, P, { storagePath: PATH }, TODAY);
    expect(r).toEqual({ ok: false, kind: 'failed', reason: 'rejected' });
    expect(store.remove).toHaveBeenCalledWith([PATH]);
  });

  it('removes the file again when the row is refused, so no file is left without a row', async () => {
    const store = fakeStore();
    const gateway = fakeGateway({ insertPhoto: vi.fn(async () => ({ ok: false as const, reason: 'unknown_reference' as const })) });
    const r = await savePhoto(gateway, store, P, { storagePath: PATH, phaseId: Q }, TODAY);
    expect(r).toEqual({ ok: false, kind: 'failed', reason: 'unknown_reference' });
    expect(store.remove).toHaveBeenCalledWith([PATH]);
  });

  it('checks the details before anything else', async () => {
    const store = fakeStore();
    const r = await savePhoto(fakeGateway(), store, P, { storagePath: PATH, takenOn: '2026-11-19' }, TODAY);
    expect(r).toEqual({ ok: false, kind: 'invalid', errors: [{ field: 'takenOn', code: 'date_in_future' }] });
    expect(store.info).not.toHaveBeenCalled();
  });
});

describe('listPhotosWithUrls and deletePhoto', () => {
  it('adds a short-lived link to each photo', async () => {
    const photo = { id: ID, phaseId: null, takenOn: TODAY, note: null, storagePath: PATH, createdAt: `${TODAY}T10:00:00Z` };
    const store = fakeStore();
    const list = await listPhotosWithUrls(fakeGateway({ listPhotos: vi.fn(async () => [photo]) }), store, P);
    expect(list).toEqual([{ ...photo, url: `https://signed/${PATH}` }]);
    expect(store.signedUrls).toHaveBeenCalledWith([PATH], 600);
  });

  it('deletes the row, then its file', async () => {
    const store = fakeStore();
    expect(await deletePhoto(fakeGateway(), store, ID)).toEqual({ ok: true });
    expect(store.remove).toHaveBeenCalledWith([PATH]);
  });

  it('leaves storage alone when the row could not be deleted', async () => {
    const store = fakeStore();
    expect(await deletePhoto(fakeGateway({ deletePhoto: vi.fn(async () => null) }), store, ID)).toEqual({ ok: false });
    expect(store.remove).not.toHaveBeenCalled();
  });
});
