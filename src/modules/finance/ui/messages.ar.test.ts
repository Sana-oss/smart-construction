import { describe, expect, it } from 'vitest';
import { expenseCountAr } from './messages.ar';

describe('expenseCountAr', () => {
  it('agrees with the number, as Arabic requires', () => {
    expect(expenseCountAr(0)).toBe('لا مصروفات مسجلة');
    expect(expenseCountAr(1)).toBe('مصروف واحد مسجل');
    expect(expenseCountAr(2)).toBe('مصروفان مسجلان');
    expect(expenseCountAr(5)).toBe('5 مصروفات مسجلة');
    expect(expenseCountAr(11)).toBe('11 مصروفًا مسجلًا');
    expect(expenseCountAr(100)).toBe('100 مصروف مسجل');
  });
});
