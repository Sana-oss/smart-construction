import { describe, expect, it } from 'vitest';
import { isIsoDate, todayInTripoli } from './dates';

describe('todayInTripoli', () => {
  it('is already tomorrow in Libya (UTC+2) late in the UTC evening', () => {
    expect(todayInTripoli(new Date('2027-01-01T23:00:00Z'))).toBe('2027-01-02');
  });
  it('is the same day during the day', () => {
    expect(todayInTripoli(new Date('2026-11-16T10:00:00Z'))).toBe('2026-11-16');
  });
});

describe('isIsoDate', () => {
  it('accepts a real date', () => {
    expect(isIsoDate('2026-11-16')).toBe(true);
    expect(isIsoDate('2028-02-29')).toBe(true); // leap year
  });
  it.each(['2026-02-30', '2026-13-01', '16-11-2026', '2026-11-16T00:00:00Z', '', '٢٠٢٦-١١-١٦'])('refuses %j', (value) => {
    expect(isIsoDate(value)).toBe(false);
  });
  it('refuses values that are not text', () => {
    expect(isIsoDate(null)).toBe(false);
    expect(isIsoDate(20261116)).toBe(false);
  });
});
