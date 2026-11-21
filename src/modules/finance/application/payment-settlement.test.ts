import { describe, expect, it } from 'vitest';
import type { ContractRecord, ContractStore, PaymentRecord } from './contracts';
import type { CreateExpenseOutcome, ExpenseEditor, ExpenseGateway, NewExpenseRecord } from './expense-gateway';
import { payInstallment, releaseRetained, undoPayment, undoRelease, type SettlementDeps, type SettlementStore } from './payment-settlement';

const PROJECT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PHASE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CONTRACT = 'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1';
const PAY = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';
const RELEASE_OP = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const EXP = 'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1';
const EXP2 = 'e2e2e2e2-e2e2-4e2e-8e2e-e2e2e2e2e2e2';
const TODAY = '2026-11-21';

const contract: ContractRecord = {
  id: CONTRACT, title: 'عقد الهيكل', contractor: 'شركة البناء', valueLyd: '90000.000', scope: null, cleanupClause: null, documentId: null, createdAt: '2026-11-01T10:00:00Z',
};
const payment = (over: Partial<PaymentRecord> = {}): PaymentRecord => ({
  id: PAY, contractId: CONTRACT, title: 'الدفعة الأولى', amountLyd: '30000.000', retainedLyd: '3000.000', phaseId: PHASE, paidOn: null,
  expenseId: null, releaseOpId: RELEASE_OP, releasedOn: null, releaseExpenseId: null, createdAt: '2026-11-01T10:00:00Z', ...over,
});

function deps(p: PaymentRecord, opts: { expenseFails?: boolean; markFails?: boolean } = {}) {
  const log: string[] = [];
  const created: NewExpenseRecord[] = [];
  const marks: unknown[] = [];
  const contracts: ContractStore = {
    async listContracts() { return [contract]; },
    async listPayments() { return [p]; },
    async addContract() { throw new Error('unused'); },
    async addPayment() { throw new Error('unused'); },
    async updateContract() { throw new Error('unused'); },
    async updatePayment() { throw new Error('unused'); },
    async removeContract() { throw new Error('unused'); },
    async removePayment() { throw new Error('unused'); },
  };
  const expenses: ExpenseGateway = {
    async createExpense(e): Promise<CreateExpenseOutcome> {
      if (opts.expenseFails) return { status: 'failed', reason: 'unavailable' };
      created.push(e);
      log.push('expense');
      return { status: 'created', expenseId: created.length === 1 ? EXP : EXP2 };
    },
  };
  const editor: ExpenseEditor = {
    async updateExpense() { throw new Error('unused'); },
    async deleteExpense(_p, id) { log.push(`delete:${id}`); return { status: 'done', receiptPath: null }; },
  };
  const settlement: SettlementStore = {
    async markPaid(c) { log.push('markPaid'); marks.push(c); return opts.markFails ? { status: 'failed', reason: 'unavailable' } : { status: 'done' }; },
    async markUnpaid() { log.push('markUnpaid'); return { status: 'done' }; },
    async release(c) { log.push('release'); marks.push(c); return { status: 'done' }; },
    async undoRelease() { log.push('undoRelease'); return { status: 'done' }; },
  };
  const d: SettlementDeps = { contracts, settlement, expenses, editor, files: { uploadTicket: async () => null, info: async () => null, signedUrls: async () => new Map(), remove: async () => undefined } };
  return { d, log, created, marks };
}

const due = { state: 'due' } as const;
const waiting = { state: 'waiting', gaps: ['phase_not_done', 'phase_without_photo'] } as const;
const cmd = { projectId: PROJECT, paymentId: PAY };

describe('payInstallment', () => {
  it('makes one expense of the amount minus the retained part, then marks the payment paid', async () => {
    const { d, log, created, marks } = deps(payment());
    expect(await payInstallment(d, { ...cmd, paidOn: '2026-11-20', expenseType: 'labor' }, due, TODAY)).toEqual({ ok: true });
    expect(log).toEqual(['expense', 'markPaid']);
    expect(created[0]).toMatchObject({ projectId: PROJECT, title: 'الدفعة الأولى · عقد الهيكل', amountLyd: '27000.000', expenseType: 'labor', phaseId: PHASE, payee: 'شركة البناء', paidOn: '2026-11-20', clientOpId: PAY });
    expect(marks[0]).toEqual({ paymentId: PAY, paidOn: '2026-11-20', expenseId: EXP, gaps: null });
  });

  it('asks first when the payment is not due, and saves nothing (D2)', async () => {
    const { d, log } = deps(payment());
    expect(await payInstallment(d, cmd, waiting, TODAY)).toEqual({ ok: false, kind: 'needs_confirm', gaps: ['phase_not_done', 'phase_without_photo'] });
    expect(log).toEqual([]);
  });

  it('pays after the owner confirmed, and hands the missing items over to be logged', async () => {
    const { d, marks } = deps(payment());
    expect(await payInstallment(d, { ...cmd, confirmed: true }, waiting, TODAY)).toEqual({ ok: true });
    expect(marks[0]).toMatchObject({ gaps: ['phase_not_done', 'phase_without_photo'] });
  });

  it('makes no expense when the whole payment is retained', async () => {
    const { d, log, marks } = deps(payment({ amountLyd: '100.000', retainedLyd: '100.000' }));
    expect(await payInstallment(d, cmd, due, TODAY)).toEqual({ ok: true });
    expect(log).toEqual(['markPaid']);
    expect(marks[0]).toMatchObject({ expenseId: null });
  });

  it('refuses a wrong date without touching anything', async () => {
    const { d, log } = deps(payment());
    const r = await payInstallment(d, { ...cmd, paidOn: '2026-11-22' }, due, TODAY);
    expect(r).toEqual({ ok: false, kind: 'invalid', errors: [{ field: 'paidOn', code: 'date_in_future' }] });
    expect(log).toEqual([]);
  });

  it('refuses a payment that is already paid, or not found', async () => {
    expect(await payInstallment(deps(payment({ paidOn: '2026-11-01' })).d, cmd, due, TODAY)).toEqual({ ok: false, kind: 'failed', reason: 'already_paid' });
    expect(await payInstallment(deps(payment()).d, { ...cmd, paymentId: 'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0' }, due, TODAY)).toEqual({ ok: false, kind: 'failed', reason: 'not_found' });
    expect(await payInstallment(deps(payment()).d, { ...cmd, paymentId: 'x' }, due, TODAY)).toEqual({ ok: false, kind: 'failed', reason: 'not_found' });
  });

  it('leaves the payment unpaid when the expense cannot be made, and a retry reuses the same key', async () => {
    const { d, log } = deps(payment(), { expenseFails: true });
    expect(await payInstallment(d, cmd, due, TODAY)).toEqual({ ok: false, kind: 'failed', reason: 'unavailable' });
    expect(log).toEqual([]);
    const second = deps(payment(), { markFails: true });
    expect(await payInstallment(second.d, cmd, due, TODAY)).toEqual({ ok: false, kind: 'failed', reason: 'unavailable' });
    expect(second.created[0].clientOpId).toBe(PAY); // a second try sends the same key: the database returns the same expense
  });
});

describe('releaseRetained', () => {
  const paid = () => payment({ paidOn: '2026-11-01', expenseId: EXP });

  it('makes the second expense of the retained part with the release key, then marks the release', async () => {
    const { d, log, created, marks } = deps(paid());
    expect(await releaseRetained(d, { ...cmd, releasedOn: '2026-11-20' }, { allPhasesDone: true }, TODAY)).toEqual({ ok: true });
    expect(log).toEqual(['expense', 'release']);
    expect(created[0]).toMatchObject({ amountLyd: '3000.000', title: 'إفراج المحتجز · الدفعة الأولى · عقد الهيكل', paidOn: '2026-11-20', clientOpId: RELEASE_OP });
    expect(marks[0]).toEqual({ paymentId: PAY, releasedOn: '2026-11-20', expenseId: EXP, early: false });
  });

  it('asks first while a phase is not done, then releases and says it was early', async () => {
    const { d, log, marks } = deps(paid());
    expect(await releaseRetained(d, cmd, { allPhasesDone: false }, TODAY)).toEqual({ ok: false, kind: 'needs_confirm' });
    expect(log).toEqual([]);
    expect(await releaseRetained(d, { ...cmd, confirmed: true }, { allPhasesDone: false }, TODAY)).toEqual({ ok: true });
    expect(marks[0]).toMatchObject({ early: true });
  });

  it('refuses an unpaid payment, one already released, one with nothing retained', async () => {
    expect(await releaseRetained(deps(payment()).d, cmd, { allPhasesDone: true }, TODAY)).toEqual({ ok: false, kind: 'failed', reason: 'not_paid' });
    expect(await releaseRetained(deps(payment({ paidOn: '2026-11-01', releasedOn: '2026-11-05' })).d, cmd, { allPhasesDone: true }, TODAY)).toEqual({ ok: false, kind: 'failed', reason: 'already_released' });
    expect(await releaseRetained(deps(payment({ paidOn: '2026-11-01', retainedLyd: '0.000' })).d, cmd, { allPhasesDone: true }, TODAY)).toEqual({ ok: false, kind: 'failed', reason: 'nothing_retained' });
  });

  it('refuses a release date before the payment', async () => {
    const { d } = deps(paid());
    expect(await releaseRetained(d, { ...cmd, releasedOn: '2026-10-31' }, { allPhasesDone: true }, TODAY)).toEqual({ ok: false, kind: 'invalid', errors: [{ field: 'releasedOn', code: 'before_paid' }] });
  });
});

describe('undoPayment / undoRelease', () => {
  it('deletes the payment expense, then marks it unpaid', async () => {
    const { d, log } = deps(payment({ paidOn: '2026-11-01', expenseId: EXP }));
    expect(await undoPayment(d, cmd)).toEqual({ ok: true });
    expect(log).toEqual([`delete:${EXP}`, 'markUnpaid']);
  });

  it('only marks it unpaid when the payment has no expense (all retained, or the owner deleted it)', async () => {
    const { d, log } = deps(payment({ paidOn: '2026-11-01', expenseId: null }));
    expect(await undoPayment(d, cmd)).toEqual({ ok: true });
    expect(log).toEqual(['markUnpaid']);
  });

  it('refuses an unpaid payment, and one whose release must be undone first', async () => {
    expect(await undoPayment(deps(payment()).d, cmd)).toEqual({ ok: false, reason: 'not_paid' });
    const released = deps(payment({ paidOn: '2026-11-01', releasedOn: '2026-11-05', releaseExpenseId: EXP2 }));
    expect(await undoPayment(released.d, cmd)).toEqual({ ok: false, reason: 'already_released' });
    expect(released.log).toEqual([]);
  });

  it('undoes a release: deletes the release expense, then clears the release', async () => {
    const { d, log } = deps(payment({ paidOn: '2026-11-01', releasedOn: '2026-11-05', releaseExpenseId: EXP2 }));
    expect(await undoRelease(d, cmd)).toEqual({ ok: true });
    expect(log).toEqual([`delete:${EXP2}`, 'undoRelease']);
    expect(await undoRelease(deps(payment({ paidOn: '2026-11-01' })).d, cmd)).toEqual({ ok: false, reason: 'not_released' });
  });
});
