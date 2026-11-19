import { describe, expect, it, vi } from 'vitest';
import { addMovement, getCashflow, removeMovement, type CashflowStore, type MovementItem } from './cashflow';

const PROJECT = '11111111-1111-4111-8111-111111111111';
const ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const TODAY = '2026-11-19';

function fakeStore(movements: MovementItem[] = [], spent: { amountLyd: string; paidOn: string }[] = []) {
  const store: CashflowStore = {
    movements: vi.fn(async () => movements),
    expensesPaidSince: vi.fn(async () => spent),
    add: vi.fn(async () => ({ status: 'done' as const })),
    remove: vi.fn(async () => ({ status: 'done' as const })),
  };
  return store;
}

const row = (kind: 'income' | 'obligation', amountLyd: string, date: string, id = date + kind): MovementItem => ({
  id,
  kind,
  title: 'حركة',
  amountLyd,
  date,
  party: 'جهة',
});

describe('addMovement (S16.2)', () => {
  it('stores the validated movement with the amount as a decimal string', async () => {
    const store = fakeStore();
    const r = await addMovement(store, { projectId: PROJECT, kind: 'obligation', title: 'توريد مواد', amount: '15,000', date: '2026-11-20', party: 'المورد' });
    expect(r).toEqual({ ok: true });
    expect(store.add).toHaveBeenCalledWith({
      projectId: PROJECT,
      kind: 'obligation',
      title: 'توريد مواد',
      amountLyd: '15000.000',
      date: '2026-11-20',
      party: 'المورد',
    });
  });

  it('never calls the database when the input is invalid', async () => {
    const store = fakeStore();
    const r = await addMovement(store, { projectId: PROJECT, kind: 'income' });
    expect(r.ok).toBe(false);
    expect(store.add).not.toHaveBeenCalled();
  });
});

describe('removeMovement', () => {
  it('removes a row of a known kind', async () => {
    const store = fakeStore();
    expect(await removeMovement(store, { projectId: PROJECT, kind: 'income', id: ID.toUpperCase() })).toEqual({ ok: true });
    expect(store.remove).toHaveBeenCalledWith(PROJECT, 'income', ID);
  });

  it('answers "not found" for anything that is not an id or a kind, without calling the database', async () => {
    const store = fakeStore();
    expect(await removeMovement(store, { projectId: PROJECT, kind: 'expenses', id: ID })).toEqual({ ok: false, reason: 'not_found' });
    expect(await removeMovement(store, { projectId: PROJECT, kind: 'income', id: '1' })).toEqual({ ok: false, reason: 'not_found' });
    expect(store.remove).not.toHaveBeenCalled();
  });
});

describe('getCashflow (S16.1)', () => {
  const project = { id: PROJECT, availableNowLyd: '60000.000', availableAsOf: '2026-11-10' };

  it('sorts by date, flags overdue obligations, and computes the outlook from the liquidity', async () => {
    const store = fakeStore(
      [row('income', '40000', '2026-11-25'), row('obligation', '15000', '2026-11-20'), row('obligation', '15000', '2026-11-16')],
      [{ amountLyd: '5000', paidOn: '2026-11-12' }],
    );
    const v = await getCashflow(store, project, TODAY);
    expect(store.expensesPaidSince).toHaveBeenCalledWith(PROJECT, '2026-11-10');
    expect(v.items.map((i) => [i.date, i.overdue])).toEqual([
      ['2026-11-16', true],
      ['2026-11-20', false],
      ['2026-11-25', false],
    ]);
    expect(v.liquidity?.amount.toFixed(3)).toBe('55000.000');
    expect(v.outlook?.balanceAtEnd.toFixed(3)).toBe('65000.000');
    expect(v.window.income.toFixed(3)).toBe('40000.000');
  });

  it('shows no balance without the available figure, but still the totals of the 30 days', async () => {
    const store = fakeStore([row('obligation', '1000', '2026-11-20')]);
    const v = await getCashflow(store, { id: PROJECT, availableNowLyd: null, availableAsOf: null }, TODAY);
    expect(v.liquidity).toBeNull();
    expect(v.outlook).toBeNull();
    expect(v.window.obligations.toFixed(3)).toBe('1000.000');
    expect(store.expensesPaidSince).not.toHaveBeenCalled();
  });
});
