import { describe, expect, it } from 'vitest';
import {
  EXPENSE_PAYEE_MAX,
  EXPENSE_TITLE_MAX,
  validateExpenseEdit,
  validateNewExpense,
  type NewExpenseInput,
} from './expense';

const TODAY = '2026-11-16';
const OP = '33333333-3333-4333-8333-333333333333';
const PHASE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

// The three answers the owner must type, plus the id the browser makes.
const base: NewExpenseInput = { title: 'حديد تسليح', amount: '12,000', expenseType: 'materials', clientOpId: OP };
const check = (input: NewExpenseInput) => validateNewExpense({ ...base, ...input }, TODAY);
const errorsOf = (input: NewExpenseInput) => {
  const r = check(input);
  return r.ok ? [] : r.errors;
};

describe('validateNewExpense: name, amount and type are required (design S14.1)', () => {
  it('accepts the three required answers alone', () => {
    const r = check({});
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.amountLyd.toFixed(3)).toBe('12000.000');
    expect(r.value).toMatchObject({
      title: 'حديد تسليح',
      expenseType: 'materials',
      phaseId: null,
      payee: null,
      paidOn: null,
      clientOpId: OP,
    });
  });

  it.each(['materials', 'labor', 'services'])('accepts the type %s', (expenseType) => {
    expect(check({ expenseType }).ok).toBe(true);
  });

  it('reports each missing required answer', () => {
    expect(validateNewExpense({ clientOpId: OP }, TODAY)).toEqual({
      ok: false,
      errors: [
        { field: 'title', code: 'required' },
        { field: 'amount', code: 'required' },
        { field: 'expenseType', code: 'required' },
      ],
    });
  });

  it('refuses a type that is not in the list', () => {
    expect(errorsOf({ expenseType: 'مواد' })).toEqual([{ field: 'expenseType', code: 'unknown_choice' }]);
    expect(errorsOf({ expenseType: 'other' })).toEqual([{ field: 'expenseType', code: 'unknown_choice' }]);
  });

  it('cleans the name and limits its length', () => {
    const r = check({ title: '  حديد   تسليح ' });
    expect(r.ok && r.value.title).toBe('حديد تسليح');
    expect(errorsOf({ title: 'ح' })).toEqual([{ field: 'title', code: 'too_short' }]);
    expect(check({ title: 'ن'.repeat(EXPENSE_TITLE_MAX) }).ok).toBe(true);
    expect(errorsOf({ title: 'ن'.repeat(EXPENSE_TITLE_MAX + 1) })).toEqual([{ field: 'title', code: 'too_long' }]);
  });
});

describe('validateNewExpense: the amount', () => {
  it.each([
    ['٢٬٥٠٠٫٧٥', '2500.750'],
    ['2,500.75', '2500.750'],
    ['0.001', '0.001'],
    ['99999999999.999', '99999999999.999'],
  ])('reads %j as %s', (typed, expected) => {
    const r = check({ amount: typed });
    expect(r.ok && r.value.amountLyd.toFixed(3)).toBe(expected);
  });

  it.each([
    ['', 'required'],
    ['   ', 'required'],
    ['abc', 'invalid_number'],
    ['-5', 'invalid_number'],
    ['1.2345', 'invalid_number'], // more than 3 decimals is refused, not rounded
    ['0', 'must_be_positive'],
    ['0.000', 'must_be_positive'],
    ['100000000000', 'too_large'], // 12 digits: does not fit numeric(14,3)
  ])('refuses the amount %j with %s', (typed, code) => {
    expect(errorsOf({ amount: typed })).toEqual([{ field: 'amount', code }]);
  });
});

describe('validateNewExpense: phase, supplier and date', () => {
  it('keeps the phase, supplier and date when given', () => {
    const r = check({ phaseId: PHASE.toUpperCase(), payee: '  مورد   الحديد ', paidOn: '2026-11-09' });
    expect(r.ok && r.value).toMatchObject({ phaseId: PHASE, payee: 'مورد الحديد', paidOn: '2026-11-09' });
  });

  it('refuses a phase that is not an id', () => {
    expect(errorsOf({ phaseId: '2' })).toEqual([{ field: 'phaseId', code: 'invalid_id' }]);
  });

  it('limits the supplier length', () => {
    expect(check({ payee: 'ن'.repeat(EXPENSE_PAYEE_MAX) }).ok).toBe(true);
    expect(errorsOf({ payee: 'ن'.repeat(EXPENSE_PAYEE_MAX + 1) })).toEqual([{ field: 'payee', code: 'too_long' }]);
  });

  it('accepts today and past dates, refuses future and impossible dates', () => {
    expect(check({ paidOn: TODAY }).ok).toBe(true);
    expect(errorsOf({ paidOn: '2026-11-17' })).toEqual([{ field: 'paidOn', code: 'date_in_future' }]);
    expect(errorsOf({ paidOn: '2026-02-30' })).toEqual([{ field: 'paidOn', code: 'invalid_date' }]);
    expect(errorsOf({ paidOn: '16/11/2026' })).toEqual([{ field: 'paidOn', code: 'invalid_date' }]);
  });
});

describe('validateNewExpense: client_op_id (NFR-REL-01)', () => {
  it('is required and must be a UUID', () => {
    expect(errorsOf({ clientOpId: '' })).toEqual([{ field: 'clientOpId', code: 'required' }]);
    expect(errorsOf({ clientOpId: 'again' })).toEqual([{ field: 'clientOpId', code: 'invalid_id' }]);
  });
});

describe('validateExpenseEdit (decision of 19 Nov 2026)', () => {
  const edit = { title: 'حديد تسليح', amount: '12,500.5', expenseType: 'labor', paidOn: '2026-11-10' };

  it('accepts the same fields as a new expense, without a client_op_id', () => {
    const r = validateExpenseEdit({ ...edit, phaseId: PHASE.toUpperCase(), payee: '  مصنع   الحديد ' }, TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.amountLyd.toFixed(3)).toBe('12500.500');
    expect(r.value).toMatchObject({ title: 'حديد تسليح', expenseType: 'labor', phaseId: PHASE, payee: 'مصنع الحديد', paidOn: '2026-11-10' });
    expect(r.value).not.toHaveProperty('clientOpId');
  });

  it('requires the date (an empty date must not move the expense to today)', () => {
    const r = validateExpenseEdit({ ...edit, paidOn: '  ' }, TODAY);
    expect(r).toEqual({ ok: false, errors: [{ field: 'paidOn', code: 'required' }] });
  });

  it('applies the rules of a new expense', () => {
    const r = validateExpenseEdit({ title: 'x', amount: '0', expenseType: 'food', paidOn: '2026-11-17' }, TODAY);
    expect(r.ok ? [] : r.errors).toEqual([
      { field: 'title', code: 'too_short' },
      { field: 'amount', code: 'must_be_positive' },
      { field: 'expenseType', code: 'unknown_choice' },
      { field: 'paidOn', code: 'date_in_future' },
    ]);
  });
});
