import { describe, expect, it } from 'vitest';
import { isUuid } from './ids';

describe('isUuid', () => {
  it('accepts a UUID in either letter case', () => {
    expect(isUuid('33333333-3333-4333-8333-333333333333')).toBe(true);
    expect(isUuid('A1B2C3D4-E5F6-4A7B-8C9D-0E1F2A3B4C5D')).toBe(true);
  });

  it.each(['', 'not-a-uuid', '33333333-3333-4333-8333-33333333333', ' 33333333-3333-4333-8333-333333333333'])(
    'refuses the text %j',
    (value) => {
      expect(isUuid(value)).toBe(false);
    },
  );

  it('refuses values that are not text', () => {
    expect(isUuid(null)).toBe(false);
    expect(isUuid(42)).toBe(false);
  });
});
