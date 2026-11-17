import { describe, expect, it } from 'vitest';
import { monthOf, monthSummary } from './expense-list';

describe('monthOf', () => {
  it('gives the month that contains the date, as a half-open range', () => {
    expect(monthOf('2026-11-18')).toEqual({ from: '2026-11-01', to: '2026-12-01' });
  });

  it('works on the first and the last day of a month', () => {
    expect(monthOf('2026-11-01')).toEqual({ from: '2026-11-01', to: '2026-12-01' });
    expect(monthOf('2026-02-28')).toEqual({ from: '2026-02-01', to: '2026-03-01' });
  });

  it('moves to January of the next year after December', () => {
    expect(monthOf('2026-12-31')).toEqual({ from: '2026-12-01', to: '2027-01-01' });
  });

  it('refuses anything that is not a calendar date', () => {
    expect(() => monthOf('18/11/2026')).toThrow();
    expect(() => monthOf('2026-13-01')).toThrow();
  });
});

describe('monthSummary', () => {
  it('adds the amounts exactly, with no floating-point error', () => {
    const s = monthSummary(['0.1', '0.2', '12000.750']);
    expect(s.total.toFixed(3)).toBe('12001.050');
    expect(s.count).toBe(3);
  });

  it('is zero for a month with no expenses', () => {
    const s = monthSummary([]);
    expect(s.total.toFixed(3)).toBe('0.000');
    expect(s.count).toBe(0);
  });
});
