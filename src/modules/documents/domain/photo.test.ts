import { describe, expect, it } from 'vitest';
import {
  checkPickedFile,
  groupPhotosByPhase,
  fitWithin,
  isHeicFile,
  isPhotoPathOf,
  PHOTO_MAX_INPUT_BYTES,
  photoStoragePath,
  validatePhotoDetails,
} from './photo';

const P = '11111111-1111-4111-8111-111111111111';
const Q = '22222222-2222-4222-8222-222222222222';
const PHOTO = '33333333-3333-4333-8333-333333333333';
const TODAY = '2026-11-18';

describe('fitWithin', () => {
  it('scales a phone photo down to 1600 on its longest side, keeping its shape', () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1200, height: 1600 });
  });

  it('never scales a small photo up', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1600, 900)).toEqual({ width: 1600, height: 900 });
  });

  it('keeps very thin images at least 1 pixel wide', () => {
    expect(fitWithin(10000, 2)).toEqual({ width: 1600, height: 1 });
  });

  it('refuses an empty image', () => {
    expect(() => fitWithin(0, 100)).toThrow();
  });
});

describe('storage paths', () => {
  it("puts a photo under its project's folder", () => {
    expect(photoStoragePath(P, PHOTO)).toBe(`${P}/photos/${PHOTO}.jpg`);
  });

  it('accepts only a photo path of the same project (the browser could send any path)', () => {
    expect(isPhotoPathOf(P, `${P}/photos/${PHOTO}.jpg`)).toBe(true);
    expect(isPhotoPathOf(P, `${Q}/photos/${PHOTO}.jpg`)).toBe(false);
    expect(isPhotoPathOf(P, `${P}/photos/../${Q}/x.jpg`)).toBe(false);
    expect(isPhotoPathOf(P, `${P}/documents/${PHOTO}.jpg`)).toBe(false);
  });
});

describe('validatePhotoDetails', () => {
  it('uses today when no date is given, and trims the note', () => {
    expect(validatePhotoDetails({ phaseId: P, takenOn: '', note: '  تسليح السقف  ' }, TODAY)).toEqual({
      ok: true,
      value: { phaseId: P, takenOn: TODAY, note: 'تسليح السقف' },
    });
  });

  it('allows a photo with no phase and no note', () => {
    expect(validatePhotoDetails({}, TODAY)).toEqual({ ok: true, value: { phaseId: null, takenOn: TODAY, note: null } });
  });

  it('refuses a date after today, a wrong phase id and a note over 500 characters', () => {
    const r = validatePhotoDetails({ phaseId: 'x', takenOn: '2026-11-19', note: 'ب'.repeat(501) }, TODAY);
    expect(r).toEqual({
      ok: false,
      errors: [
        { field: 'phaseId', code: 'invalid_id' },
        { field: 'takenOn', code: 'date_in_future' },
        { field: 'note', code: 'too_long' },
      ],
    });
  });
});

describe('checkPickedFile and isHeicFile', () => {
  it('accepts images, including HEIC files a browser reports without a type', () => {
    expect(checkPickedFile({ size: 3_000_000, type: 'image/jpeg', name: 'a.jpg' })).toBeNull();
    expect(checkPickedFile({ size: 3_000_000, type: '', name: 'IMG_0001.HEIC' })).toBeNull();
  });

  it('refuses a PDF and a file over the limit', () => {
    expect(checkPickedFile({ size: 10, type: 'application/pdf', name: 'a.pdf' })).toEqual({ field: 'file', code: 'not_an_image' });
    expect(checkPickedFile({ size: PHOTO_MAX_INPUT_BYTES + 1, type: 'image/jpeg', name: 'a.jpg' })).toEqual({
      field: 'file',
      code: 'too_large',
    });
  });

  it('recognises HEIC by type or by name', () => {
    expect(isHeicFile({ type: 'image/heic', name: 'x' })).toBe(true);
    expect(isHeicFile({ type: 'image/heif', name: 'x' })).toBe(true);
    expect(isHeicFile({ type: '', name: 'IMG_0001.heic' })).toBe(true);
    expect(isHeicFile({ type: 'image/jpeg', name: 'a.jpg' })).toBe(false);
  });
});

describe('groupPhotosByPhase (S31.1)', () => {
  const phases = [
    { id: 'ph1', position: 1 },
    { id: 'ph2', position: 2 },
  ];
  const photo = (id: string, phaseId: string | null, takenOn: string, createdAt = `${takenOn}T10:00:00Z`) => ({ id, phaseId, takenOn, createdAt });

  it('orders groups by the phase plan, photos newest first, unlinked photos last', () => {
    const groups = groupPhotosByPhase(
      [
        photo('a', 'ph2', '2026-11-09'),
        photo('b', null, '2026-11-01'),
        photo('c', 'ph1', '2026-10-20'),
        photo('d', 'ph2', '2026-11-12'),
        photo('e', 'ph2', '2026-11-12', '2026-11-12T11:00:00Z'),
      ],
      phases,
    );
    expect(groups.map((g) => g.phaseId)).toEqual(['ph1', 'ph2', null]);
    expect(groups[1].photos.map((p) => p.id)).toEqual(['e', 'd', 'a']);
    expect(groups[1].latest).toBe('2026-11-12');
  });

  it('treats a photo whose phase is unknown as unlinked', () => {
    const groups = groupPhotosByPhase([photo('a', 'gone', '2026-11-09')], phases);
    expect(groups).toEqual([{ phaseId: null, photos: [photo('a', 'gone', '2026-11-09')], latest: '2026-11-09' }]);
  });

  it('is empty without photos', () => {
    expect(groupPhotosByPhase([], phases)).toEqual([]);
  });
});
