import { describe, expect, it } from 'vitest';
import {
  cleanSearch,
  EXPENSE_SEARCH_MAX,
  filterQuery,
  isFiltered,
  NO_FILTER,
  parseExpenseFilter,
  periodRange,
} from './expense-filter';

const PHASE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('parseExpenseFilter (design S13.2)', () => {
  it('reads the four fields of the address', () => {
    expect(parseExpenseFilter({ q: '  حديد ', period: 'this_month', phase: PHASE.toUpperCase(), type: 'materials' })).toEqual({
      search: 'حديد',
      period: 'this_month',
      phaseId: PHASE,
      expenseType: 'materials',
    });
  });

  it('drops anything unknown instead of passing it on', () => {
    expect(parseExpenseFilter({ q: '', period: 'forever', phase: "1' or 1=1", type: 'food' })).toEqual(NO_FILTER);
    expect(parseExpenseFilter({})).toEqual(NO_FILTER);
  });

  it('takes the first value when a field repeats', () => {
    expect(parseExpenseFilter({ type: ['labor', 'materials'] }).expenseType).toBe('labor');
  });
});

describe('cleanSearch', () => {
  it('keeps Arabic and Latin letters, digits and single spaces', () => {
    expect(cleanSearch('  حديد   تسليح 12 mm ')).toBe('حديد تسليح 12 mm');
  });

  it('removes characters that mean something to pattern matching or filters', () => {
    expect(cleanSearch('%_*,()"\'\\حديد.')).toBe('حديد');
    expect(cleanSearch('a,title.eq.x')).toBe('a title eq x');
  });

  it('limits the length', () => {
    expect([...cleanSearch('ب'.repeat(100))]).toHaveLength(EXPENSE_SEARCH_MAX);
  });
});

describe('isFiltered and filterQuery', () => {
  it('no filter = no query', () => {
    expect(isFiltered(NO_FILTER)).toBe(false);
    expect(filterQuery(NO_FILTER)).toBe('');
  });

  it('writes only what is set, and reads back to the same filter', () => {
    const f = { ...NO_FILTER, search: 'حديد', expenseType: 'materials' as const };
    expect(isFiltered(f)).toBe(true);
    const q = filterQuery(f);
    expect(q).toBe('q=%D8%AD%D8%AF%D9%8A%D8%AF&type=materials');
    expect(parseExpenseFilter(Object.fromEntries(new URLSearchParams(q)))).toEqual(f);
  });
});

describe('periodRange (months in Libya)', () => {
  it('all periods', () => {
    expect(periodRange('all', '2026-11-19')).toBeNull();
    expect(periodRange('this_month', '2026-11-19')).toEqual({ from: '2026-11-01', to: '2026-12-01' });
    expect(periodRange('last_month', '2026-11-19')).toEqual({ from: '2026-10-01', to: '2026-11-01' });
    expect(periodRange('last_3_months', '2026-11-19')).toEqual({ from: '2026-09-01', to: '2026-12-01' });
    expect(periodRange('this_year', '2026-11-19')).toEqual({ from: '2026-01-01', to: '2027-01-01' });
  });

  it('crosses the year boundary', () => {
    expect(periodRange('last_month', '2027-01-05')).toEqual({ from: '2026-12-01', to: '2027-01-01' });
    expect(periodRange('last_3_months', '2027-02-28')).toEqual({ from: '2026-12-01', to: '2027-03-01' });
    expect(periodRange('this_month', '2026-12-31')).toEqual({ from: '2026-12-01', to: '2027-01-01' });
  });
});
