import { describe, expect, it } from 'vitest';
import { EXPENSE_LIST_LIMIT, findExpense, listExpenses, type ExpenseListItem, type ExpenseReader } from './list-expenses';

const item = (n: number): ExpenseListItem => ({
  id: `id-${n}`,
  title: `مصروف ${n}`,
  amountLyd: '100.000',
  expenseType: 'materials',
  phaseId: null,
  payee: null,
  paidOn: '2026-11-10',
  receiptPath: null,
});

function fakeReader(items: ExpenseListItem[], totalCount: number, monthAmounts: string[]) {
  const calls: { limit?: number; range?: { from: string; to: string } } = {};
  const reader: ExpenseReader = {
    async recentExpenses(_projectId, limit) {
      calls.limit = limit;
      return { items, totalCount };
    },
    async expenseById(_projectId, expenseId) {
      return items.find((i) => i.id === expenseId) ?? null;
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
      expenseById: async () => null,
      amountsPaidBetween: async () => {
        throw new Error('incomplete');
      },
    };
    await expect(listExpenses(reader, 'p1', '2026-11-18')).rejects.toThrow('incomplete');
  });

  it('adds a 10-minute link to each shown expense that has a receipt photo, and none to the others', async () => {
    const withReceipt = { ...item(1), receiptPath: 'p1/receipts/r1.jpg' };
    const { reader } = fakeReader([withReceipt, item(2)], 2, []);
    const asked: { paths?: string[]; ttl?: number } = {};
    const store = {
      uploadTicket: async () => null,
      info: async () => null,
      remove: async () => {},
      signedUrls: async (paths: string[], ttl: number) => {
        asked.paths = paths;
        asked.ttl = ttl;
        return new Map(paths.map((x) => [x, `https://signed/${x}`]));
      },
    };
    const list = await listExpenses(reader, 'p1', '2026-11-18', store);
    expect(asked).toEqual({ paths: ['p1/receipts/r1.jpg'], ttl: 600 });
    expect(list.items[0].receiptUrl).toBe('https://signed/p1/receipts/r1.jpg');
    expect(list.items[1].receiptUrl).toBeNull();
  });
});

describe('findExpense (edit screen, decision of 19 Nov 2026)', () => {
  const PROJECT = '11111111-1111-4111-8111-111111111111';
  const ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const store = {
    uploadTicket: async () => null,
    info: async () => null,
    remove: async () => {},
    signedUrls: async (paths: string[]) => new Map(paths.map((x) => [x, `https://signed/${x}`])),
  };

  it('returns the expense with a link to its receipt photo', async () => {
    const { reader } = fakeReader([{ ...item(1), id: ID, receiptPath: `${PROJECT}/receipts/r.jpg` }], 1, []);
    const found = await findExpense(reader, PROJECT, ID.toUpperCase(), store);
    expect(found?.id).toBe(ID);
    expect(found?.receiptUrl).toBe(`https://signed/${PROJECT}/receipts/r.jpg`);
  });

  it('answers null for an expense that is not there, or an id that is not an id', async () => {
    const { reader } = fakeReader([{ ...item(1), id: ID }], 1, []);
    expect(await findExpense(reader, PROJECT, '22222222-2222-4222-8222-222222222222', store)).toBeNull();
    expect(await findExpense(reader, PROJECT, 'id-1', store)).toBeNull();
    expect((await findExpense(reader, PROJECT, ID))?.receiptUrl).toBeNull();
  });
});
