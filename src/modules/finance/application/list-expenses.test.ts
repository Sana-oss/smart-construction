import { describe, expect, it } from 'vitest';
import { EXPENSE_LIST_LIMIT, listExpenses, type ExpenseListItem, type ExpenseReader } from './list-expenses';

const item = (n: number): ExpenseListItem => ({
  id: `id-${n}`,
  title: `مصروف ${n}`,
  amountLyd: '100.000',
  expenseType: 'materials',
  phaseId: null,
  payee: null,
  paidOn: '2026-11-10',
});

function fakeReader(items: ExpenseListItem[], totalCount: number, monthAmounts: string[]) {
  const calls: { limit?: number; range?: { from: string; to: string } } = {};
  const reader: ExpenseReader = {
    async recentExpenses(_projectId, limit) {
      calls.limit = limit;
      return { items, totalCount };
    },
    async amountsPaidBetween(_projectId, range) {
      calls.range = range;
      return monthAmounts;
    },
  };
  return { reader, calls };
}

describe('listExpenses', () => {
  it('asks for the newest expenses up to the limit, and for this month in Libya', async () => {
    const { reader, calls } = fakeReader([item(1)], 1, ['100.000']);
    await listExpenses(reader, 'p1', '2026-11-18');
    expect(calls.limit).toBe(EXPENSE_LIST_LIMIT);
    expect(calls.range).toEqual({ from: '2026-11-01', to: '2026-12-01' });
  });

  it("sums this month's amounts in the domain, not in the screen", async () => {
    const { reader } = fakeReader([item(1), item(2)], 2, ['12000.750', '4500']);
    const list = await listExpenses(reader, 'p1', '2026-11-18');
    expect(list.month.total.toFixed(3)).toBe('16500.750');
    expect(list.month.count).toBe(2);
    expect(list.items).toHaveLength(2);
  });

  it('keeps the full count, so the screen can say that older expenses are not shown', async () => {
    const { reader } = fakeReader([item(1)], 73, []);
    const list = await listExpenses(reader, 'p1', '2026-11-18');
    expect(list.totalCount).toBe(73);
    expect(list.month.count).toBe(0);
  });

  it('lets a storage failure through instead of showing a wrong total', async () => {
    const reader: ExpenseReader = {
      recentExpenses: async () => ({ items: [], totalCount: 0 }),
      amountsPaidBetween: async () => {
        throw new Error('incomplete');
      },
    };
    await expect(listExpenses(reader, 'p1', '2026-11-18')).rejects.toThrow('incomplete');
  });
});
