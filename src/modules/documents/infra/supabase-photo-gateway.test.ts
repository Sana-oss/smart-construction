import { describe, expect, it } from 'vitest';
import { mapPhotoError, toPhotoRecord } from './supabase-photo-gateway';

describe('photo gateway mapping', () => {
  it('turns database codes into our reasons', () => {
    expect(mapPhotoError({ code: '42501' })).toBe('not_allowed');
    expect(mapPhotoError({ code: '23503' })).toBe('unknown_reference');
    expect(mapPhotoError({ code: '23505' })).toBe('rejected');
    expect(mapPhotoError({ code: 'XX000' })).toBe('unavailable');
  });

  it('maps a row', () => {
    expect(
      toPhotoRecord({ id: 'a', phase_id: null, taken_on: '2026-11-18', note: 'n', storage_path: 'p', created_at: '2026-11-18T10:00:00Z' }),
    ).toEqual({ id: 'a', phaseId: null, takenOn: '2026-11-18', note: 'n', storagePath: 'p', createdAt: '2026-11-18T10:00:00Z' });
  });
});
