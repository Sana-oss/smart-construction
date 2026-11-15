import { describe, expect, it } from 'vitest';
import { budgetSummary, totalSpent } from './budget';

describe('budgetSummary', () => {
  it('computes remaining and contingency', () => {
    const s = budgetSummary('100000', '25000.5', '10');
    expect(s.remaining.toFixed(3)).toBe('74999.500');
    expect(s.contingency.toFixed(3)).toBe('10000.000');
    expect(s.overBudget).toBe(false);
  });
  it('flags overspending', () => {
    expect(budgetSummary('1000', '1000.001', '10').overBudget).toBe(true);
  });
});

describe('totalSpent', () => {
  it('adds the money spent before the app to the recorded expenses', () => {
    expect(totalSpent('460000', '1000.375').toFixed(3)).toBe('461000.375');
  });
  it('is exact where JS numbers are not (0.1 + 0.2)', () => {
    expect(totalSpent('0.1', '0.2').toFixed(3)).toBe('0.300');
  });
  it('is the recorded expenses alone when nothing was spent before', () => {
    expect(totalSpent('0', '2500').toFixed(3)).toBe('2500.000');
  });
});
