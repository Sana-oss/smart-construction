import { describe, expect, it } from 'vitest';
import { budgetSummary } from './budget';

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
