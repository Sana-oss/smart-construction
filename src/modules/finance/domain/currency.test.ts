import { describe, expect, it } from 'vitest';
import { latestRates, readRate, sortRates, toLyd, validateForeign, validateRate, type RateRecord } from './currency';
import { validateNewExpense } from './expense';

const TODAY = '2026-11-20';
const OP = '33333333-3333-4333-8333-333333333333';

describe('readRate (numeric(12,4))', () => {
  it('reads Latin and Arabic digits and keeps 4 places', () => {
    expect(readRate('7.25')).toEqual({ ok: true, value: '7.2500' });
    expect(readRate('٧٫٢٥')).toEqual({ ok: true, value: '7.2500' });
    expect(readRate('0.1234')).toEqual({ ok: true, value: '0.1234' });
  });
  it('refuses zero, more than 4 decimals, more than 8 digits, and text', () => {
    expect(readRate('0')).toEqual({ ok: false, code: 'must_be_positive' });
    expect(readRate('7.12345')).toEqual({ ok: false, code: 'invalid_number' });
    expect(readRate('123456789')).toEqual({ ok: false, code: 'too_large' });
    expect(readRate('')).toEqual({ ok: false, code: 'required' });
    expect(readRate('-7')).toEqual({ ok: false, code: 'invalid_number' });
  });
});

describe('validateForeign and toLyd (FR-FIN-04)', () => {
  it('computes the LYD equivalent, rounded half up to 3 places', () => {
    const r = validateForeign({ currency: 'usd', originalAmount: '1,000', rate: '7.25' });
    expect(r.ok && [r.value.currency, r.value.originalAmount.toFixed(3), r.value.rateLydPerUnit, r.value.amountLyd.toFixed(3)]).toEqual([
      'USD',
      '1000.000',
      '7.2500',
      '7250.000',
    ]);
    expect(toLyd('0.333', '1.0005').toFixed(3)).toBe('0.333'); // 0.3331665 -> 0.333
    expect(toLyd('1.001', '0.5005').toFixed(3)).toBe('0.501'); // 0.5010005 -> 0.501
    expect(toLyd('0.005', '0.1').toFixed(3)).toBe('0.001'); // 0.0005 -> half up
  });

  it('reports every missing or wrong part', () => {
    const r = validateForeign({ currency: 'GBP', originalAmount: '0', rate: 'x' });
    expect(r.ok ? [] : r.errors).toEqual([
      { field: 'currency', code: 'unknown_choice' },
      { field: 'originalAmount', code: 'must_be_positive' },
      { field: 'rate', code: 'invalid_number' },
    ]);
  });

  it('refuses an equivalent that rounds to zero', () => {
    const r = validateForeign({ currency: 'CNY', originalAmount: '0.001', rate: '0.1' });
    expect(r.ok ? [] : r.errors).toEqual([{ field: 'originalAmount', code: 'must_be_positive' }]);
  });
});

describe('validateNewExpense with a foreign currency', () => {
  const base = { title: 'حديد تركي', expenseType: 'materials', clientOpId: OP };

  it('ignores the LYD amount and uses original × rate', () => {
    const r = validateNewExpense({ ...base, amount: '', currency: 'TRY', originalAmount: '10,000', rate: '0.2' }, TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.amountLyd.toFixed(3)).toBe('2000.000');
    expect(r.value.foreign).toMatchObject({ currency: 'TRY', rateLydPerUnit: '0.2000' });
  });

  it('stays exactly as before without a currency', () => {
    const r = validateNewExpense({ ...base, amount: '500' }, TODAY);
    expect(r.ok && [r.value.amountLyd.toFixed(3), r.value.foreign]).toEqual(['500.000', null]);
  });

  it('reports the foreign fields, not the LYD amount, when a currency is chosen', () => {
    const r = validateNewExpense({ ...base, currency: 'USD' }, TODAY);
    expect(r.ok ? [] : r.errors).toEqual([
      { field: 'originalAmount', code: 'required' },
      { field: 'rate', code: 'required' },
    ]);
  });
});

describe('validateRate (the reference rates log)', () => {
  it('accepts a rate with today as the default date', () => {
    expect(validateRate({ currency: 'eur', rate: '7.9', note: ' السوق  الموازي ' }, TODAY)).toEqual({
      ok: true,
      value: { currency: 'EUR', lydPerUnit: '7.9000', rateDate: null, note: 'السوق الموازي' },
    });
  });
  it('refuses a future date, an unknown currency and a long note', () => {
    const r = validateRate({ currency: 'LYD', rate: '1', rateDate: '2026-11-21', note: 'ن'.repeat(201) }, TODAY);
    expect(r.ok ? [] : r.errors).toEqual([
      { field: 'currency', code: 'unknown_choice' },
      { field: 'rateDate', code: 'date_in_future' },
      { field: 'note', code: 'too_long' },
    ]);
  });
});

describe('latestRates and sortRates', () => {
  const rec = (id: string, currency: RateRecord['currency'], lydPerUnit: string, rateDate: string, createdAt = `${rateDate}T10:00:00Z`): RateRecord => ({
    id,
    currency,
    lydPerUnit,
    rateDate,
    note: null,
    createdAt,
  });
  const records = [
    rec('1', 'USD', '7.1000', '2026-11-01'),
    rec('2', 'USD', '7.2500', '2026-11-15'),
    rec('3', 'USD', '7.2000', '2026-11-15', '2026-11-15T08:00:00Z'), // same day, recorded earlier
    rec('4', 'EUR', '7.9000', '2026-11-10'),
  ];
  it('takes the newest rate of each currency', () => {
    const l = latestRates(records);
    expect([l.USD?.lydPerUnit, l.EUR?.lydPerUnit, l.TRY]).toEqual(['7.2500', '7.9000', undefined]);
  });
  it('sorts the log newest first', () => {
    expect(sortRates(records).map((r) => r.id)).toEqual(['2', '3', '4', '1']);
  });
});
