import { describe, expect, it } from 'vitest';
import { addMoney, money } from '@/shared-kernel';
import { phaseUse } from './allocation';
import { expenseReport, REPORT_TYPES, type ReportExpense } from './expense-report';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const GONE = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const phases = [{ id: A }, { id: B }];

const e = (phaseId: string | null, expenseType: ReportExpense['expenseType'], amountLyd: string): ReportExpense => ({
  phaseId,
  expenseType,
  amountLyd,
});

describe('expenseReport (FR-FIN-05)', () => {
  const expenses = [
    e(A, 'materials', '1000.500'),
    e(A, 'labor', '250'),
    e(A, 'materials', '0.250'),
    e(B, 'services', '75.125'),
    e(null, 'labor', '40'),
    e(GONE, 'materials', '10'),
    e(A, null, '5'),
  ];

  it('sums by phase and by type, in plan order, with «بلا مرحلة» last', () => {
    const r = expenseReport({ phases, expenses, allocations: null });
    expect(r.rows.map((x) => x.phaseId)).toEqual([A, B, null]);
    const [a, b, none] = r.rows;
    expect(a.spent.toFixed(3)).toBe('1255.750');
    expect(a.count).toBe(4);
    expect(a.byType.materials.toFixed(3)).toBe('1000.750');
    expect(a.byType.labor.toFixed(3)).toBe('250.000');
    expect(a.byType.unspecified.toFixed(3)).toBe('5.000');
    expect(b.byType.services.toFixed(3)).toBe('75.125');
    // A phase this project no longer lists joins «بلا مرحلة», so the total still matches.
    expect(none.spent.toFixed(3)).toBe('50.000');
    expect(none.count).toBe(2);
  });

  it('the total matches the expenses, the rows and the types (acceptance criterion)', () => {
    const r = expenseReport({ phases, expenses, allocations: null });
    expect(r.total.toFixed(3)).toBe('1380.875');
    expect(r.count).toBe(expenses.length);
    expect(addMoney('0', ...r.rows.map((x) => x.spent)).toFixed(3)).toBe(r.total.toFixed(3));
    expect(addMoney('0', ...REPORT_TYPES.map((t) => r.byType[t])).toFixed(3)).toBe(r.total.toFixed(3));
    for (const row of r.rows) {
      expect(addMoney('0', ...REPORT_TYPES.map((t) => row.byType[t])).toFixed(3)).toBe(row.spent.toFixed(3));
    }
    expect(r.rows.reduce((n, x) => n + x.count, 0)).toBe(r.count);
  });

  it('lists every phase even with nothing spent, and no «بلا مرحلة» row when none', () => {
    const r = expenseReport({ phases, expenses: [e(A, 'labor', '1')], allocations: null });
    expect(r.rows.map((x) => x.phaseId)).toEqual([A, B]);
    expect(r.rows[1].spent.isZero()).toBe(true);
    expect(r.rows[1].count).toBe(0);
  });

  it('an empty period gives zeros, not an error', () => {
    const r = expenseReport({ phases, expenses: [], allocations: null });
    expect(r.total.isZero()).toBe(true);
    expect(r.count).toBe(0);
    expect(r.rows).toHaveLength(2);
  });

  it('without allocations (a period other than «كل الفترات») the rows carry no plan', () => {
    const r = expenseReport({ phases, expenses, allocations: null });
    expect(r.withPlan).toBe(false);
    expect(r.rows.every((x) => x.plan === null)).toBe(true);
  });

  it('with allocations: planned against actual, with the same warning as S15.2 (D5 = 10%)', () => {
    const allocations = new Map([
      [A, money('1000')],
      [B, null],
    ]);
    const r = expenseReport({ phases, expenses, allocations });
    expect(r.withPlan).toBe(true);
    const [a, b, none] = r.rows;
    expect(a.plan).toEqual({ allocated: money('1000'), usedPct: 125, over: true });
    expect(b.plan).toEqual({ allocated: null, usedPct: null, over: false });
    expect(none.plan).toBeNull();
  });
});

describe('phaseUse (shared with the budget plan)', () => {
  it('warns only above allocation × 1.10; floors the percent; no plan without a positive allocation', () => {
    expect(phaseUse(money('1000'), money('1100'))).toEqual({ usedPct: 110, over: false });
    expect(phaseUse(money('1000'), money('1100.001'))).toEqual({ usedPct: 110, over: true });
    expect(phaseUse(money('3'), money('1'))).toEqual({ usedPct: 33, over: false });
    expect(phaseUse(money('0'), money('5'))).toEqual({ usedPct: null, over: false });
    expect(phaseUse(null, money('5'))).toEqual({ usedPct: null, over: false });
  });
});
