import { describe, expect, it } from 'vitest';
import { contractSummary } from './contracts';
import { cashNow, decidePayment, decideRelease, expenseFromPayment, expenseFromRelease, paidAmount, paymentDue, paymentStage } from './payments';

const TODAY = '2026-11-21';
const PHASE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PAYMENT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const RELEASE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const fixed = (m: { toFixed: (n: number) => string }) => m.toFixed(3);

describe('paymentDue (FR-FIN-09)', () => {
  it('has no condition when the payment is not tied to a phase', () => {
    expect(paymentDue({ phaseId: null, phaseStatus: null, phasePhotoCount: 0 })).toEqual({ state: 'not_tied' });
  });

  it('is due when the phase is done and has a photo', () => {
    expect(paymentDue({ phaseId: PHASE, phaseStatus: 'done', phasePhotoCount: 1 })).toEqual({ state: 'due' });
    expect(paymentDue({ phaseId: PHASE, phaseStatus: 'done', phasePhotoCount: 12 })).toEqual({ state: 'due' });
  });

  it('waits, and says what is missing', () => {
    expect(paymentDue({ phaseId: PHASE, phaseStatus: 'in_progress', phasePhotoCount: 3 })).toEqual({ state: 'waiting', gaps: ['phase_not_done'] });
    expect(paymentDue({ phaseId: PHASE, phaseStatus: 'done', phasePhotoCount: 0 })).toEqual({ state: 'waiting', gaps: ['phase_without_photo'] });
    expect(paymentDue({ phaseId: PHASE, phaseStatus: 'closing', phasePhotoCount: 0 })).toEqual({ state: 'waiting', gaps: ['phase_not_done', 'phase_without_photo'] });
  });

  it('treats a phase that was not found as not done', () => {
    expect(paymentDue({ phaseId: PHASE, phaseStatus: null, phasePhotoCount: 2 })).toEqual({ state: 'waiting', gaps: ['phase_not_done'] });
  });
});

describe('stage and money of an installment', () => {
  const p = (paidOn: string | null, retainedLyd: string, releasedOn: string | null = null) => ({ amountLyd: '30000', retainedLyd, paidOn, releasedOn });

  it('tells scheduled, paid with the retained part held, and paid in full', () => {
    expect(paymentStage(p(null, '3000'))).toBe('scheduled');
    expect(paymentStage(p('2026-11-01', '3000'))).toBe('paid_retained_held');
    expect(paymentStage(p('2026-11-01', '3000', '2026-11-15'))).toBe('paid');
    expect(paymentStage(p('2026-11-01', '0'))).toBe('paid');
  });

  it('counts as paid only what left the owner\'s hands', () => {
    expect(fixed(paidAmount(p(null, '3000')))).toBe('0.000');
    expect(fixed(paidAmount(p('2026-11-01', '3000')))).toBe('27000.000');
    expect(fixed(paidAmount(p('2026-11-01', '3000', '2026-11-15')))).toBe('30000.000');
    expect(fixed(paidAmount(p('2026-11-01', '0')))).toBe('30000.000');
  });

  it('transfers the amount minus the retained part now', () => {
    expect(fixed(cashNow({ amountLyd: '30000', retainedLyd: '3000' }))).toBe('27000.000');
    expect(fixed(cashNow({ amountLyd: '100', retainedLyd: '100' }))).toBe('0.000');
  });
});

describe('contractSummary with paid and released installments', () => {
  it('does not count a retained part as paid until it is released', () => {
    const s = contractSummary({
      value: '90000',
      payments: [
        { amountLyd: '30000', retainedLyd: '3000', paidOn: '2026-11-01' },
        { amountLyd: '15000', retainedLyd: '1500', paidOn: '2026-11-02', releasedOn: '2026-11-10' },
        { amountLyd: '10000', retainedLyd: '1000', paidOn: null },
      ],
    });
    expect([fixed(s.paid), fixed(s.remaining)]).toEqual(['42000.000', '48000.000']); // 27,000 + 15,000
    expect(fixed(s.retained)).toBe('4000.000'); // 3,000 held + 1,000 not paid yet; the released 1,500 is gone
  });
});

describe('decidePayment (FR-FIN-09, D2)', () => {
  const due = { state: 'due' } as const;
  const waiting = { state: 'waiting', gaps: ['phase_not_done', 'phase_without_photo'] } as const;

  it('pays today as «يد عاملة» when the owner typed nothing', () => {
    expect(decidePayment({}, due, TODAY)).toEqual({ ok: true, paidOn: TODAY, expenseType: 'labor', confirmedGaps: null });
  });

  it('keeps the date and the type the owner chose', () => {
    expect(decidePayment({ paidOn: '2026-11-10', expenseType: 'materials' }, due, TODAY)).toEqual({ ok: true, paidOn: '2026-11-10', expenseType: 'materials', confirmedGaps: null });
  });

  it('refuses a wrong date, a future date and an unknown type', () => {
    expect(decidePayment({ paidOn: 'x' }, due, TODAY)).toEqual({ ok: false, kind: 'invalid', errors: [{ field: 'paidOn', code: 'invalid_date' }] });
    expect(decidePayment({ paidOn: '2026-11-22' }, due, TODAY)).toEqual({ ok: false, kind: 'invalid', errors: [{ field: 'paidOn', code: 'date_in_future' }] });
    expect(decidePayment({ expenseType: 'cars' }, due, TODAY)).toEqual({ ok: false, kind: 'invalid', errors: [{ field: 'expenseType', code: 'unknown_choice' }] });
  });

  it('asks first when the payment is not due, and never blocks', () => {
    expect(decidePayment({}, waiting, TODAY)).toEqual({ ok: false, kind: 'needs_confirm', gaps: ['phase_not_done', 'phase_without_photo'] });
    expect(decidePayment({ confirmed: false }, waiting, TODAY)).toMatchObject({ kind: 'needs_confirm' });
    expect(decidePayment({ confirmed: true }, waiting, TODAY)).toEqual({
      ok: true,
      paidOn: TODAY,
      expenseType: 'labor',
      confirmedGaps: ['phase_not_done', 'phase_without_photo'],
    });
  });

  it('does not ask for a payment that is not tied to a phase', () => {
    expect(decidePayment({}, { state: 'not_tied' }, TODAY)).toMatchObject({ ok: true, confirmedGaps: null });
  });

  it('shows the invalid fields before asking for the confirmation', () => {
    expect(decidePayment({ paidOn: 'x' }, waiting, TODAY)).toMatchObject({ kind: 'invalid' });
  });
});

describe('decideRelease (FR-FIN-09, D2)', () => {
  const ctx = (allPhasesDone: boolean) => ({ today: TODAY, paidOn: '2026-11-01', allPhasesDone });

  it('releases today when every phase is done', () => {
    expect(decideRelease({}, ctx(true))).toEqual({ ok: true, releasedOn: TODAY, expenseType: 'labor', confirmedEarly: false });
  });

  it('asks first while a phase is not done, then releases and says it was early', () => {
    expect(decideRelease({}, ctx(false))).toEqual({ ok: false, kind: 'needs_confirm' });
    expect(decideRelease({ confirmed: true }, ctx(false))).toEqual({ ok: true, releasedOn: TODAY, expenseType: 'labor', confirmedEarly: true });
  });

  it('refuses a wrong date, a future date, and a date before the payment', () => {
    expect(decideRelease({ releasedOn: 'x' }, ctx(true))).toEqual({ ok: false, kind: 'invalid', errors: [{ field: 'releasedOn', code: 'invalid_date' }] });
    expect(decideRelease({ releasedOn: '2026-11-22' }, ctx(true))).toEqual({ ok: false, kind: 'invalid', errors: [{ field: 'releasedOn', code: 'date_in_future' }] });
    expect(decideRelease({ releasedOn: '2026-10-31' }, ctx(true))).toEqual({ ok: false, kind: 'invalid', errors: [{ field: 'releasedOn', code: 'before_paid' }] });
  });

  it('keeps the expense type the owner chose and refuses an unknown one', () => {
    expect(decideRelease({ expenseType: 'services' }, ctx(true))).toMatchObject({ ok: true, expenseType: 'services' });
    expect(decideRelease({ expenseType: 'cars' }, ctx(true))).toEqual({ ok: false, kind: 'invalid', errors: [{ field: 'expenseType', code: 'unknown_choice' }] });
  });

  it('accepts the payment day itself', () => {
    expect(decideRelease({ releasedOn: '2026-11-01' }, ctx(true))).toMatchObject({ ok: true, releasedOn: '2026-11-01' });
  });
});

describe('the expenses of a payment (FR-FIN-09)', () => {
  const base = { contractTitle: 'عقد الهيكل الخرساني', paymentTitle: 'الدفعة الأولى', contractor: 'شركة البناء', phaseId: PHASE };

  it('makes one expense of the amount minus the retained part, keyed by the payment id', () => {
    expect(expenseFromPayment({ ...base, paymentId: PAYMENT, amountLyd: '30000', retainedLyd: '3000', paidOn: '2026-11-01', expenseType: 'labor' })).toEqual({
      title: 'الدفعة الأولى · عقد الهيكل الخرساني',
      amount: '27000.000',
      expenseType: 'labor',
      phaseId: PHASE,
      payee: 'شركة البناء',
      paidOn: '2026-11-01',
      clientOpId: PAYMENT,
    });
  });

  it('makes none when the whole payment is retained', () => {
    expect(expenseFromPayment({ ...base, paymentId: PAYMENT, amountLyd: '100', retainedLyd: '100', paidOn: '2026-11-01', expenseType: 'labor' })).toBeNull();
  });

  it('makes the second expense of the retained part with its own key', () => {
    expect(expenseFromRelease({ ...base, releaseOpId: RELEASE, retainedLyd: '3000', releasedOn: '2026-11-20', expenseType: 'labor' })).toEqual({
      title: 'إفراج المحتجز · الدفعة الأولى · عقد الهيكل الخرساني',
      amount: '3000.000',
      expenseType: 'labor',
      phaseId: PHASE,
      payee: 'شركة البناء',
      paidOn: '2026-11-20',
      clientOpId: RELEASE,
    });
  });

  it('cuts a long title to the expense limit (80) instead of failing', () => {
    const e = expenseFromPayment({
      ...base,
      contractTitle: 'ع'.repeat(80),
      paymentTitle: 'د'.repeat(80),
      paymentId: PAYMENT,
      amountLyd: '10',
      retainedLyd: '0',
      paidOn: '2026-11-01',
      expenseType: 'services',
    });
    expect([...(e?.title ?? '')]).toHaveLength(80);
    expect(e?.title?.endsWith('…')).toBe(true);
  });
});
