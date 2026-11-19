import { describe, expect, it } from 'vitest';
import { applyCriteria, toListItem } from './supabase-expense-reader';

const row = {
  id: 'e1',
  title: 'حديد تسليح',
  amount_lyd: '12000.750',
  expense_type: 'materials',
  phase_id: 'ph1',
  payee: 'مورد الحديد',
  paid_on: '2026-11-09',
  receipt_path: null as string | null,
};

describe('toListItem', () => {
  it('keeps the amount as the exact decimal text from the database', () => {
    expect(toListItem(row)).toEqual({
      id: 'e1',
      title: 'حديد تسليح',
      amountLyd: '12000.750',
      expenseType: 'materials',
      phaseId: 'ph1',
      payee: 'مورد الحديد',
      paidOn: '2026-11-09',
      receiptPath: null,
    });
  });

  it('keeps the receipt photo path', () => {
    expect(toListItem({ ...row, receipt_path: 'p/receipts/r.jpg' }).receiptPath).toBe('p/receipts/r.jpg');
  });

  it('shows an older expense without a name or type instead of hiding it (the list must match the totals)', () => {
    const item = toListItem({ ...row, title: null, expense_type: null });
    expect(item.title).toBe('');
    expect(item.expenseType).toBeNull();
  });

  it('does not trust an unknown type from the database', () => {
    expect(toListItem({ ...row, expense_type: 'other' }).expenseType).toBeNull();
  });
});

describe('applyCriteria (design S13.2)', () => {
  function recorder() {
    const calls: [string, ...string[]][] = [];
    const q = {
      gte: (...a: string[]) => (calls.push(['gte', ...a]), q),
      lt: (...a: string[]) => (calls.push(['lt', ...a]), q),
      eq: (...a: string[]) => (calls.push(['eq', ...a]), q),
      or: (...a: string[]) => (calls.push(['or', ...a]), q),
    };
    return { q, calls };
  }

  it('adds nothing without criteria', () => {
    const { q, calls } = recorder();
    applyCriteria(q, { range: null, phaseId: null, expenseType: null, search: '' });
    expect(calls).toEqual([]);
  });

  it('adds the period, phase, type and a search on the name or the supplier', () => {
    const { q, calls } = recorder();
    applyCriteria(q, { range: { from: '2026-11-01', to: '2026-12-01' }, phaseId: 'ph1', expenseType: 'materials', search: 'حديد تسليح' });
    expect(calls).toEqual([
      ['gte', 'paid_on', '2026-11-01'],
      ['lt', 'paid_on', '2026-12-01'],
      ['eq', 'phase_id', 'ph1'],
      ['eq', 'expense_type', 'materials'],
      ['or', 'title.ilike.*حديد*تسليح*,payee.ilike.*حديد*تسليح*'],
    ]);
  });
});
