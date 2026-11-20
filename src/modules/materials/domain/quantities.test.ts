import { describe, expect, it } from 'vitest';
import { itemProgress, purchaseWouldExceed, validateItem, validatePurchase } from './quantities';

const TODAY = '2026-11-20';
const PHASE = '7f1c0d2e-5b8a-4c3d-9e6f-1a2b3c4d5e6f';

describe('validateItem (FR-MAT-01)', () => {
  it('accepts a line and cleans it; waste is 0 when empty', () => {
    const r = validateItem({ material: ' حديد  تسليح ', unit: 'طن', plannedQty: '١٢', phaseId: PHASE, source: 'جدول كميات المهندس' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({ material: 'حديد تسليح', unit: 'طن', phaseId: PHASE, source: 'جدول كميات المهندس', verifiedBy: null });
    expect([r.value.plannedQty.toString(), r.value.wastePct.toString()]).toEqual(['12', '0']);
  });

  it('keeps the waste the owner typed', () => {
    const r = validateItem({ material: 'أسمنت', unit: 'كيس', plannedQty: '300', wastePct: '2.5', verifiedBy: 'م. أحمد' });
    expect(r.ok && [r.value.wastePct.toString(), r.value.verifiedBy]).toEqual(['2.5', 'م. أحمد']);
  });

  it('reports every wrong field', () => {
    const r = validateItem({ material: 'x', unit: '', plannedQty: '0', wastePct: '101', phaseId: 'abc', source: 'م'.repeat(81) });
    expect(r.ok ? [] : r.errors).toEqual([
      { field: 'material', code: 'too_short' },
      { field: 'unit', code: 'required' },
      { field: 'plannedQty', code: 'must_be_positive' },
      { field: 'wastePct', code: 'too_large' },
      { field: 'phaseId', code: 'invalid_reference' },
      { field: 'source', code: 'too_long' },
    ]);
  });

  it('refuses too many decimals', () => {
    const r = validateItem({ material: 'رمل', unit: 'م³', plannedQty: '1.2345', wastePct: '1.234' });
    expect(r.ok ? [] : r.errors).toEqual([
      { field: 'plannedQty', code: 'too_many_decimals' },
      { field: 'wastePct', code: 'too_many_decimals' },
    ]);
  });
});

describe('validatePurchase (FR-MAT-02, FR-FIN-03)', () => {
  it('gives the expense amount: qty × unit price (design S21.1: 3 × 4,000 = 12,000)', () => {
    const r = validatePurchase({ qty: '3', unitPrice: '4,000', supplier: 'مورد الحديد', purchasedOn: '2026-11-09' }, TODAY);
    expect(r.ok && [r.value.totalLyd.toFixed(3), r.value.supplier, r.value.purchasedOn]).toEqual(['12000.000', 'مورد الحديد', '2026-11-09']);
  });

  it('rounds the total to the dirham', () => {
    const r = validatePurchase({ qty: '1.333', unitPrice: '2.5' }, TODAY);
    expect(r.ok && [r.value.totalLyd.toFixed(3), r.value.purchasedOn]).toEqual(['3.333', null]);
  });

  it('reports every wrong field; a purchase is not free and not in the future', () => {
    const r = validatePurchase({ qty: '', unitPrice: '0', supplier: 'م'.repeat(81), purchasedOn: '2026-11-21' }, TODAY);
    expect(r.ok ? [] : r.errors).toEqual([
      { field: 'qty', code: 'required' },
      { field: 'unitPrice', code: 'must_be_positive' },
      { field: 'supplier', code: 'too_long' },
      { field: 'purchasedOn', code: 'date_in_future' },
    ]);
  });

  it('refuses a total too large for the database', () => {
    const r = validatePurchase({ qty: '99999999999', unitPrice: '2' }, TODAY);
    expect(r.ok ? [] : r.errors).toEqual([{ field: 'total', code: 'too_large' }]);
  });
});

describe('itemProgress (FR-MAT-02, FR-MAT-03)', () => {
  it('the requirement example: planned 5, waste 10% (allowed 5.5): 5.8 warns, 5.4 does not', () => {
    expect(itemProgress('5', '10', ['5.8']).isOver).toBe(true);
    expect(itemProgress('5', '10', ['5.4']).isOver).toBe(false);
    expect(itemProgress('5', '10', ['5.5']).isOver).toBe(false);
  });

  it('remaining = planned − purchased, never below 0', () => {
    const p = itemProgress('12', '0', ['5', '3']);
    expect([p.purchasedQty.toString(), p.remainingQty.toString(), p.allowedQty.toString()]).toEqual(['8', '4', '12']);
    const over = itemProgress('12', '5', ['13']);
    expect([over.remainingQty.toString(), over.allowedQty.toString(), over.isOver, over.overBy.toString()]).toEqual(['0', '12.6', true, '0.4']);
  });

  it('nothing bought yet', () => {
    const p = itemProgress('80', '0', []);
    expect([p.purchasedQty.toString(), p.remainingQty.toString(), p.isOver]).toEqual(['0', '80', false]);
  });
});

describe('purchaseWouldExceed (FR-MAT-03, decision D2)', () => {
  it('warns before a purchase takes the line above the allowed quantity', () => {
    const p = itemProgress('5', '10', ['5']);
    expect(purchaseWouldExceed(p, '0.5').exceeds).toBe(false);
    const w = purchaseWouldExceed(p, '0.8');
    expect([w.exceeds, w.afterQty.toString(), w.overBy.toString()]).toEqual([true, '5.8', '0.3']);
  });
});
