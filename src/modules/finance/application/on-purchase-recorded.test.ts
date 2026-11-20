import { describe, expect, it } from 'vitest';
import type { PurchaseRecordedPayload } from '@/shared-kernel';
import { expenseFromPurchase } from '../domain/purchase-expense';
import type { ExpenseGateway, NewExpenseRecord } from './expense-gateway';
import { handlePurchaseRecorded } from './on-purchase-recorded';

const PROJECT = '0b9d3c1a-2e4f-4a6b-8c7d-9e0f1a2b3c4d';
const PHASE = '7f1c0d2e-5b8a-4c3d-9e6f-1a2b3c4d5e6f';
const EVENT: PurchaseRecordedPayload = {
  purchaseId: '3c2b1a09-8f7e-4d6c-9b5a-0f1e2d3c4b5a',
  material: 'حديد تسليح',
  unit: 'طن',
  phaseId: PHASE,
  qty: '3.000',
  unitPriceLyd: '4000.000',
  supplier: 'مورد الحديد',
  purchasedOn: '2026-11-09',
};
const NOW = new Date('2026-11-20T10:00:00Z');

/** A fake database: one expense per clientOpId, like the unique index of 0001. */
function fakeGateway() {
  const stored = new Map<string, NewExpenseRecord & { id: string }>();
  const gateway: ExpenseGateway = {
    async createExpense(e) {
      const found = stored.get(e.clientOpId);
      if (found) return { status: 'duplicate', expenseId: found.id };
      const id = `expense-${stored.size + 1}`;
      stored.set(e.clientOpId, { ...e, id });
      return { status: 'created', expenseId: id };
    },
  };
  return { gateway, stored };
}

describe('expenseFromPurchase (FR-FIN-03)', () => {
  it('one materials expense of qty × unit price, keyed on the purchase', () => {
    expect(expenseFromPurchase(EVENT)).toEqual({
      title: 'حديد تسليح',
      amount: '12000.000',
      expenseType: 'materials',
      phaseId: PHASE,
      payee: 'مورد الحديد',
      paidOn: '2026-11-09',
      clientOpId: EVENT.purchaseId,
    });
  });

  it('rounds the amount to the dirham', () => {
    expect(expenseFromPurchase({ ...EVENT, qty: '1.333', unitPriceLyd: '2.500' }).amount).toBe('3.333');
  });
});

describe('handlePurchaseRecorded (FR-FIN-03: handling the event twice does not double the cost)', () => {
  it('creates the expense once; a second delivery returns the same expense', async () => {
    const { gateway, stored } = fakeGateway();
    const first = await handlePurchaseRecorded(gateway, PROJECT, EVENT, NOW);
    const again = await handlePurchaseRecorded(gateway, PROJECT, EVENT, NOW);
    expect(first).toEqual({ ok: true, expenseId: 'expense-1', duplicate: false });
    expect(again).toEqual({ ok: true, expenseId: 'expense-1', duplicate: true });
    expect(stored.size).toBe(1);
    expect(stored.get(EVENT.purchaseId)).toMatchObject({ amountLyd: '12000.000', expenseType: 'materials', payee: 'مورد الحديد', paidOn: '2026-11-09' });
  });

  it('passes a database failure on', async () => {
    const gateway: ExpenseGateway = { createExpense: async () => ({ status: 'failed', reason: 'unavailable' }) };
    expect(await handlePurchaseRecorded(gateway, PROJECT, EVENT, NOW)).toEqual({ ok: false, reason: 'unavailable' });
  });
});
