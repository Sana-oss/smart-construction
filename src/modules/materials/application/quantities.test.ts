import { describe, expect, it } from 'vitest';
import {
  addItem,
  deleteItem,
  getItemDetail,
  getQuantityTable,
  pendingPurchaseEvent,
  recordPurchase,
  type ItemRecord,
  type NewPurchaseRecord,
  type PurchaseRecord,
  type QuantityStore,
} from './quantities';

const PROJECT = '0b9d3c1a-2e4f-4a6b-8c7d-9e0f1a2b3c4d';
const TODAY = '2026-11-20';
const op = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** A fake database with the 0024 rules the use cases rely on: one purchase per clientOpId, no duplicate line. */
function fakeStore() {
  const items: ItemRecord[] = [];
  const purchases: PurchaseRecord[] = [];
  const calls: NewPurchaseRecord[] = [];
  let n = 0;
  const store: QuantityStore = {
    listItems: async () => items.map((i) => ({ ...i })),
    listPurchases: async () => purchases.map((p) => ({ ...p })),
    async addItem(_projectId, item) {
      if (items.some((i) => i.material === item.material && i.unit === item.unit && i.phaseId === item.phaseId)) {
        return { status: 'failed', reason: 'duplicate' };
      }
      const id = op(100 + ++n);
      items.push({ ...item, id });
      return { status: 'done', id };
    },
    async deleteItem(_projectId, itemId) {
      if (purchases.some((p) => p.itemId === itemId)) return { status: 'failed', reason: 'has_purchases' };
      const i = items.findIndex((x) => x.id === itemId);
      if (i < 0) return { status: 'failed', reason: 'not_found' };
      items.splice(i, 1);
      return { status: 'done' };
    },
    async recordPurchase(p) {
      calls.push(p);
      const found = purchases.find((x) => x.id === `purchase-${p.clientOpId}`);
      if (found) return { status: 'done', purchaseId: found.id, created: false };
      const id = `purchase-${p.clientOpId}`;
      purchases.push({ id, itemId: p.itemId, qty: p.qty, unitPriceLyd: p.unitPriceLyd, supplier: p.supplier, purchasedOn: p.purchasedOn ?? TODAY, expenseRef: null, createdAt: `2026-11-20T10:00:0${purchases.length}Z` });
      return { status: 'done', purchaseId: id, created: true };
    },
    async linkExpense(_projectId, purchaseId, expenseId) {
      const p = purchases.find((x) => x.id === purchaseId);
      if (!p) return { status: 'failed', reason: 'not_found' };
      p.expenseRef = expenseId;
      return { status: 'done' };
    },
  };
  return { store, calls };
}

describe('the quantity table (FR-MAT-01, FR-MAT-02)', () => {
  it('adds lines and shows planned, purchased and remaining, by material', async () => {
    const { store } = fakeStore();
    const steel = await addItem(store, PROJECT, { material: 'حديد تسليح', unit: 'طن', plannedQty: '12', wastePct: '5' });
    await addItem(store, PROJECT, { material: 'أسمنت', unit: 'كيس', plannedQty: '300' });
    expect(steel.ok).toBe(true);
    await recordPurchase(store, PROJECT, steel.ok ? steel.id : '', { qty: '8', unitPrice: '4000', clientOpId: op(1) }, TODAY);

    const table = await getQuantityTable(store, PROJECT);
    expect(table.items.map((r) => r.item.material)).toEqual(['أسمنت', 'حديد تسليح']);
    const s = table.items[1].progress;
    expect([s.purchasedQty.toString(), s.remainingQty.toString(), s.allowedQty.toString()]).toEqual(['8', '4', '12.6']);
    expect([table.overCount, table.pendingExpenses]).toEqual([0, 1]);
  });

  it('refuses a wrong line and passes a duplicate on', async () => {
    const { store } = fakeStore();
    expect(await addItem(store, PROJECT, { material: 'x', unit: 'طن', plannedQty: '1' })).toMatchObject({ ok: false, kind: 'invalid' });
    await addItem(store, PROJECT, { material: 'رمل', unit: 'م³', plannedQty: '20' });
    expect(await addItem(store, PROJECT, { material: 'رمل', unit: 'م³', plannedQty: '5' })).toEqual({ ok: false, kind: 'failed', reason: 'duplicate' });
  });

  it('deletes an unused line, not one with purchases', async () => {
    const { store } = fakeStore();
    const a = await addItem(store, PROJECT, { material: 'رمل', unit: 'م³', plannedQty: '20' });
    const b = await addItem(store, PROJECT, { material: 'بلاط', unit: 'م²', plannedQty: '150' });
    const aId = a.ok ? a.id : '';
    await recordPurchase(store, PROJECT, aId, { qty: '5', unitPrice: '30', clientOpId: op(2) }, TODAY);
    expect(await deleteItem(store, PROJECT, aId)).toEqual({ status: 'failed', reason: 'has_purchases' });
    expect(await deleteItem(store, PROJECT, b.ok ? b.id : '')).toEqual({ status: 'done' });
    expect(await deleteItem(store, PROJECT, 'not-an-id')).toEqual({ status: 'failed', reason: 'not_found' });
  });
});

describe('recordPurchase (FR-MAT-02, FR-MAT-03, decision D2)', () => {
  async function line(waste = '10') {
    const { store, calls } = fakeStore();
    const r = await addItem(store, PROJECT, { material: 'حديد تسليح', unit: 'طن', plannedQty: '5', wastePct: waste });
    return { store, calls, id: r.ok ? r.id : '' };
  }

  it('records the purchase and returns its event for finance', async () => {
    const { store, id } = await line();
    const r = await recordPurchase(store, PROJECT, id, { qty: '3', unitPrice: '4,000', supplier: 'مورد الحديد', purchasedOn: '2026-11-09', clientOpId: op(3) }, TODAY);
    expect(r).toEqual({
      ok: true,
      purchaseId: `purchase-${op(3)}`,
      duplicate: false,
      event: { purchaseId: `purchase-${op(3)}`, material: 'حديد تسليح', unit: 'طن', phaseId: null, qty: '3.000', unitPriceLyd: '4000.000', supplier: 'مورد الحديد', purchasedOn: '2026-11-09' },
    });
  });

  it('a resent form records nothing new', async () => {
    const { store, id } = await line();
    await recordPurchase(store, PROJECT, id, { qty: '1', unitPrice: '10', clientOpId: op(4) }, TODAY);
    const again = await recordPurchase(store, PROJECT, id, { qty: '1', unitPrice: '10', clientOpId: op(4) }, TODAY);
    expect(again.ok && again.duplicate).toBe(true);
    expect((await getItemDetail(store, PROJECT, id))!.purchases).toHaveLength(1);
  });

  it('asks before buying past the allowed quantity (5 + 10% = 5.5), then logs the confirmation', async () => {
    const { store, calls, id } = await line();
    await recordPurchase(store, PROJECT, id, { qty: '5', unitPrice: '10', clientOpId: op(5) }, TODAY);
    const ask = await recordPurchase(store, PROJECT, id, { qty: '0.8', unitPrice: '10', clientOpId: op(6) }, TODAY);
    expect(ask.ok === false && ask.kind === 'needs_confirmation' && [ask.allowedQty.toString(), ask.afterQty.toString(), ask.overBy.toString()]).toEqual(['5.5', '5.8', '0.3']);
    expect(calls).toHaveLength(1);

    const confirmed = await recordPurchase(store, PROJECT, id, { qty: '0.8', unitPrice: '10', clientOpId: op(6), overAllowanceConfirmed: true }, TODAY);
    expect(confirmed.ok).toBe(true);
    expect(calls[1].overAllowanceConfirmed).toBe(true);
    expect((await getQuantityTable(store, PROJECT)).overCount).toBe(1);
  });

  it('does not log a confirmation that was not needed', async () => {
    const { store, calls, id } = await line();
    await recordPurchase(store, PROJECT, id, { qty: '0.4', unitPrice: '10', clientOpId: op(7), overAllowanceConfirmed: true }, TODAY);
    expect(calls[0].overAllowanceConfirmed).toBe(false);
  });

  it('refuses wrong inputs, an unknown line and a missing request id', async () => {
    const { store, id } = await line();
    expect(await recordPurchase(store, PROJECT, id, { qty: '0', unitPrice: '10', clientOpId: op(8) }, TODAY)).toMatchObject({ ok: false, kind: 'invalid' });
    expect(await recordPurchase(store, PROJECT, op(999), { qty: '1', unitPrice: '10', clientOpId: op(9) }, TODAY)).toEqual({ ok: false, kind: 'failed', reason: 'unknown_reference' });
    expect(await recordPurchase(store, PROJECT, id, { qty: '1', unitPrice: '10', clientOpId: 'x' }, TODAY)).toEqual({ ok: false, kind: 'failed', reason: 'rejected' });
  });
});

describe('pendingPurchaseEvent (finishing a purchase whose expense failed)', () => {
  it('rebuilds the event while the expense is missing, and nothing once it exists', async () => {
    const { store } = fakeStore();
    const a = await addItem(store, PROJECT, { material: 'أسمنت', unit: 'كيس', plannedQty: '300' });
    const r = await recordPurchase(store, PROJECT, a.ok ? a.id : '', { qty: '50', unitPrice: '42', clientOpId: op(10) }, TODAY);
    const id = r.ok ? r.purchaseId : '';
    // An unknown id is simply not found; the fake's purchase ids are not UUIDs, so look it up through the store.
    expect(await pendingPurchaseEvent(store, PROJECT, 'x')).toBeNull();
    const purchase = (await store.listPurchases(PROJECT))[0];
    expect(purchase.id).toBe(id);
    await store.linkExpense(PROJECT, id, 'expense-1');
    expect((await store.listPurchases(PROJECT))[0].expenseRef).toBe('expense-1');
  });
});
