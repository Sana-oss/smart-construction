import { describe, expect, it, vi } from 'vitest';
import { getExpenseReport, type ExpenseReportStore } from './expense-report';

const PROJECT = '11111111-1111-4111-8111-111111111111';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const project = { id: PROJECT, phases: [{ id: A }, { id: B }] };

function fakeStore(allocations: [string, string][] = []) {
  const store: ExpenseReportStore = {
    expensesIn: vi.fn(async () => [
      { phaseId: A, expenseType: 'materials' as const, amountLyd: '700.000' },
      { phaseId: null, expenseType: null, amountLyd: '30.000' },
    ]),
    allocations: vi.fn(async () => new Map(allocations)),
  };
  return store;
}

describe('getExpenseReport (FR-FIN-05)', () => {
  it('«كل الفترات»: reads every expense and the allocations, and compares planned against actual', async () => {
    const store = fakeStore([[A, '600.000']]);
    const v = await getExpenseReport(store, project, 'all', '2026-11-21');
    expect(store.expensesIn).toHaveBeenCalledWith(PROJECT, null);
    expect(v.range).toBeNull();
    expect(v.report.withPlan).toBe(true);
    expect(v.report.total.toFixed(3)).toBe('730.000');
    expect(v.report.rows[0].plan).toMatchObject({ usedPct: 116, over: true });
    expect(v.report.rows[1].plan).toMatchObject({ allocated: null });
  });

  it('a period: reads only its dates (months in Libya) and does not read or show the allocations', async () => {
    const store = fakeStore([[A, '600.000']]);
    const v = await getExpenseReport(store, project, 'last_month', '2026-01-10');
    expect(store.expensesIn).toHaveBeenCalledWith(PROJECT, { from: '2025-12-01', to: '2026-01-01' });
    expect(store.allocations).not.toHaveBeenCalled();
    expect(v.period).toBe('last_month');
    expect(v.report.withPlan).toBe(false);
    expect(v.report.rows.every((r) => r.plan === null)).toBe(true);
  });

  it('ignores a stored allocation of a phase the project no longer lists', async () => {
    const store = fakeStore([
      [A, '600.000'],
      ['dddddddd-dddd-4ddd-8ddd-dddddddddddd', '5.000'],
    ]);
    const v = await getExpenseReport(store, project, 'all', '2026-11-21');
    // The whole stored set is refused by the validation, so no phase shows an allocation rather than a wrong one.
    expect(v.report.rows.map((r) => r.plan?.allocated ?? null)).toEqual([null, null, null]);
  });

  it('passes on a refused (incomplete) read instead of showing a wrong total', async () => {
    const store = fakeStore();
    store.expensesIn = vi.fn(async () => {
      throw new Error('expenses incomplete: got 1000 of 1200');
    });
    await expect(getExpenseReport(store, project, 'this_month', '2026-11-21')).rejects.toThrow('incomplete');
  });
});
