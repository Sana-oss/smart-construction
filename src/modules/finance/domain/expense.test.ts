import { describe, expect, it } from 'vitest';
import { EXPENSE_NOTE_MAX, validateNewExpense, type NewExpenseInput } from './expense';

const TODAY = '2026-11-16';
const OP = '33333333-3333-4333-8333-333333333333';
const CATEGORY = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PHASE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const check = (input: NewExpenseInput) => validateNewExpense({ clientOpId: OP, ...input }, TODAY);
const errorsOf = (input: NewExpenseInput) => {
  const r = check(input);
  return r.ok ? [] : r.errors;
};

describe('validateNewExpense: the amount is the only required answer (FR-FIN-02)', () => {
  it('accepts an amount alone', () => {
    const r = check({ amount: '2500' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.amountLyd.toFixed(3)).toBe('2500.000');
    expect(r.value).toMatchObject({ categoryId: null, phaseId: null, note: null, paidOn: null, clientOpId: OP });
  });

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
    [undefined, 'required'],
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

describe('validateNewExpense: optional answers', () => {
  it('keeps the category, phase, note and date when given', () => {
    const r = check({
      amount: '10',
      categoryId: CATEGORY.toUpperCase(),
      phaseId: PHASE,
      note: '  حديد   تسليح ',
      paidOn: '2026-11-10',
    });
    expect(r.ok && r.value).toMatchObject({ categoryId: CATEGORY, phaseId: PHASE, note: 'حديد تسليح', paidOn: '2026-11-10' });
  });

  it('refuses an id that is not an id', () => {
    expect(errorsOf({ amount: '10', categoryId: 'cement', phaseId: '7' })).toEqual([
      { field: 'categoryId', code: 'invalid_id' },
      { field: 'phaseId', code: 'invalid_id' },
    ]);
  });

  it('limits the note length', () => {
    expect(check({ amount: '10', note: 'ن'.repeat(EXPENSE_NOTE_MAX) }).ok).toBe(true);
    expect(errorsOf({ amount: '10', note: 'ن'.repeat(EXPENSE_NOTE_MAX + 1) })).toEqual([{ field: 'note', code: 'too_long' }]);
  });

  it('accepts today and past dates, refuses future and impossible dates', () => {
    expect(check({ amount: '10', paidOn: TODAY }).ok).toBe(true);
    expect(errorsOf({ amount: '10', paidOn: '2026-11-17' })).toEqual([{ field: 'paidOn', code: 'date_in_future' }]);
    expect(errorsOf({ amount: '10', paidOn: '2026-02-30' })).toEqual([{ field: 'paidOn', code: 'invalid_date' }]);
    expect(errorsOf({ amount: '10', paidOn: '16/11/2026' })).toEqual([{ field: 'paidOn', code: 'invalid_date' }]);
  });
});

describe('validateNewExpense: client_op_id (NFR-REL-01)', () => {
  it('is required and must be a UUID', () => {
    expect(validateNewExpense({ amount: '10' }, TODAY)).toEqual({
      ok: false,
      errors: [{ field: 'clientOpId', code: 'required' }],
    });
    expect(validateNewExpense({ amount: '10', clientOpId: 'again' }, TODAY)).toEqual({
      ok: false,
      errors: [{ field: 'clientOpId', code: 'invalid_id' }],
    });
  });

  it('reports every problem at once', () => {
    expect(validateNewExpense({ amount: '', note: 'x', paidOn: 'soon' }, TODAY)).toEqual({
      ok: false,
      errors: [
        { field: 'amount', code: 'required' },
        { field: 'paidOn', code: 'invalid_date' },
        { field: 'clientOpId', code: 'required' },
      ],
    });
  });
});
