import { describe, expect, it } from 'vitest';
import { CONTRACT_SCOPE_MAX, CONTRACT_TITLE_MAX, contractSummary, validateContract, validatePayment } from './contracts';

const PHASE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const DOC = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const fixed = (m: { toFixed: (n: number) => string }) => m.toFixed(3);

describe('validateContract (FR-FIN-08)', () => {
  it('accepts a full contract and cleans the text', () => {
    const r = validateContract({
      title: ' عقد  الهيكل الخرساني ',
      contractor: 'شركة البناء',
      value: '90,000',
      scope: ' أعمال الهيكل ',
      cleanupClause: 'المقاول يزيل المخلفات على حسابه',
      documentId: DOC.toUpperCase(),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(fixed(r.value.valueLyd)).toBe('90000.000');
    expect(r.value).toMatchObject({
      title: 'عقد الهيكل الخرساني',
      contractor: 'شركة البناء',
      scope: 'أعمال الهيكل',
      cleanupClause: 'المقاول يزيل المخلفات على حسابه',
      documentId: DOC,
    });
  });

  it('keeps the optional fields empty as null', () => {
    const r = validateContract({ title: 'عقد الأساسات', contractor: 'مؤسسة النور', value: '45000' });
    expect(r.ok && [r.value.scope, r.value.cleanupClause, r.value.documentId]).toEqual([null, null, null]);
  });

  it('requires a title, a contractor and a positive value', () => {
    const r = validateContract({});
    expect(r.ok ? [] : r.errors).toEqual([
      { field: 'title', code: 'required' },
      { field: 'contractor', code: 'required' },
      { field: 'value', code: 'required' },
    ]);
    const zero = validateContract({ title: 'عقد', contractor: 'مقاول', value: '0' });
    expect(zero.ok ? [] : zero.errors).toEqual([{ field: 'value', code: 'must_be_positive' }]);
  });

  it('reports every wrong field', () => {
    const r = validateContract({
      title: 'ع',
      contractor: 'م'.repeat(81),
      value: 'abc',
      scope: 'ن'.repeat(CONTRACT_SCOPE_MAX + 1),
      cleanupClause: 'ب'.repeat(201),
      documentId: 'x',
    });
    expect(r.ok ? [] : r.errors).toEqual([
      { field: 'title', code: 'too_short' },
      { field: 'contractor', code: 'too_long' },
      { field: 'value', code: 'invalid_number' },
      { field: 'scope', code: 'too_long' },
      { field: 'cleanupClause', code: 'too_long' },
      { field: 'documentId', code: 'invalid_id' },
    ]);
    const long = validateContract({ title: 'ع'.repeat(CONTRACT_TITLE_MAX + 1), contractor: 'مقاول', value: '1' });
    expect(long.ok ? [] : long.errors).toEqual([{ field: 'title', code: 'too_long' }]);
  });
});

describe('validatePayment (FR-FIN-09)', () => {
  it('accepts a payment tied to a phase, with nothing retained by default', () => {
    const r = validatePayment({ title: ' الدفعة  الأولى ', amount: '30,000', phaseId: PHASE.toUpperCase() });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(fixed(r.value.amountLyd)).toBe('30000.000');
    expect(fixed(r.value.retainedLyd)).toBe('0.000');
    expect(r.value).toMatchObject({ title: 'الدفعة الأولى', phaseId: PHASE });
  });

  it('accepts a retained part the owner typed, up to the whole payment', () => {
    const some = validatePayment({ title: 'الدفعة الثانية', amount: '15,000', retained: '1,500' });
    expect(some.ok && fixed(some.value.retainedLyd)).toBe('1500.000');
    const all = validatePayment({ title: 'الدفعة الثانية', amount: '15000', retained: '15000' });
    expect(all.ok && fixed(all.value.retainedLyd)).toBe('15000.000');
    const zero = validatePayment({ title: 'الدفعة الثانية', amount: '15000', retained: '0' });
    expect(zero.ok && fixed(zero.value.retainedLyd)).toBe('0.000');
  });

  it('refuses a retained part larger than the payment, and a wrong number', () => {
    const over = validatePayment({ title: 'الدفعة', amount: '1000', retained: '1000.001' });
    expect(over.ok ? [] : over.errors).toEqual([{ field: 'retained', code: 'retained_exceeds_amount' }]);
    const bad = validatePayment({ title: 'الدفعة', amount: '1000', retained: 'x' });
    expect(bad.ok ? [] : bad.errors).toEqual([{ field: 'retained', code: 'invalid_number' }]);
  });

  it('reports every wrong field', () => {
    const r = validatePayment({ title: '', amount: '0', phaseId: 'x' });
    expect(r.ok ? [] : r.errors).toEqual([
      { field: 'title', code: 'required' },
      { field: 'amount', code: 'must_be_positive' },
      { field: 'phaseId', code: 'invalid_id' },
    ]);
  });
});

describe('contractSummary (S17.2)', () => {
  const pay = (amountLyd: string, paidOn: string | null = null, retainedLyd = '0') => ({ amountLyd, retainedLyd, paidOn });

  it('gives the paid, the remaining and what the schedule has not covered', () => {
    const s = contractSummary({ value: '90000', payments: [pay('30000', '2026-11-01'), pay('15000')] });
    expect([fixed(s.paid), fixed(s.remaining), fixed(s.scheduled), fixed(s.unscheduled)]).toEqual(['30000.000', '60000.000', '45000.000', '45000.000']);
    expect([s.scheduleExceedsValue, fixed(s.overScheduled)]).toEqual([false, '0.000']);
  });

  it('warns when the schedule adds up to more than the contract value, without blocking (D2)', () => {
    const s = contractSummary({ value: '10000', payments: [pay('6000'), pay('5000.500')] });
    expect(s.scheduleExceedsValue).toBe(true);
    expect([fixed(s.overScheduled), fixed(s.unscheduled)]).toEqual(['1000.500', '0.000']);
  });

  it('is exact to the dirham and sums the retained parts', () => {
    const s = contractSummary({ value: '0.3', payments: [pay('0.1', null, '0.05'), pay('0.2', null, '0.1')] });
    expect([fixed(s.scheduled), fixed(s.unscheduled), s.scheduleExceedsValue, fixed(s.retained)]).toEqual(['0.300', '0.000', false, '0.150']);
  });

  it('handles a contract with no payments yet', () => {
    const s = contractSummary({ value: '90000', payments: [] });
    expect([fixed(s.paid), fixed(s.remaining), fixed(s.unscheduled), fixed(s.retained)]).toEqual(['0.000', '90000.000', '90000.000', '0.000']);
  });
});
