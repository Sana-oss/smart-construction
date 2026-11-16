import { describe, expect, it, vi } from 'vitest';
import { createExpense, type CreateExpenseCommand } from './create-expense';
import type { CreateExpenseOutcome, ExpenseGateway } from './expense-gateway';

const PROJECT = '11111111-1111-4111-8111-111111111111';
const OP = '33333333-3333-4333-8333-333333333333';
const PHASE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const NOW = new Date('2026-11-16T10:00:00Z');

function fakeGateway(outcome: CreateExpenseOutcome = { status: 'created', expenseId: 'e1' }) {
  const gateway: ExpenseGateway = { createExpense: vi.fn(async () => outcome) };
  return gateway;
}

const command: CreateExpenseCommand = {
  projectId: PROJECT,
  title: 'حديد تسليح',
  amount: '١٢٬٠٠٠',
  expenseType: 'materials',
  clientOpId: OP,
};

describe('createExpense', () => {
  it('sends the validated expense with the amount as a decimal string', async () => {
    const gw = fakeGateway();
    const result = await createExpense(gw, { ...command, phaseId: PHASE, payee: ' مورد الحديد ', paidOn: '2026-11-09' }, NOW);
    const stored = {
      title: 'حديد تسليح',
      amountLyd: '12000.000',
      expenseType: 'materials',
      phaseId: PHASE,
      payee: 'مورد الحديد',
      paidOn: '2026-11-09',
    };
    expect(gw.createExpense).toHaveBeenCalledWith({ projectId: PROJECT, clientOpId: OP, ...stored });
    expect(result).toEqual({ ok: true, duplicate: false, saved: { expenseId: 'e1', ...stored } });
  });

  it('leaves the date to the database when none is given, and reports today in Libya', async () => {
    const gw = fakeGateway();
    const result = await createExpense(gw, command, NOW);
    expect(gw.createExpense).toHaveBeenCalledWith(expect.objectContaining({ paidOn: null, phaseId: null, payee: null }));
    expect(result.ok && result.saved.paidOn).toBe('2026-11-16');
  });

  it('never calls the database when the input is invalid', async () => {
    const gw = fakeGateway();
    expect(await createExpense(gw, { ...command, amount: '0', title: '' }, NOW)).toEqual({
      ok: false,
      kind: 'invalid',
      errors: [
        { field: 'title', code: 'required' },
        { field: 'amount', code: 'must_be_positive' },
      ],
    });
    expect(gw.createExpense).not.toHaveBeenCalled();
  });

  it('reports a repeated request as a success with the original expense (NFR-REL-01)', async () => {
    const gw = fakeGateway({ status: 'duplicate', expenseId: 'e-original' });
    const result = await createExpense(gw, command, NOW);
    expect(result.ok && result.duplicate).toBe(true);
    expect(result.ok && result.saved.expenseId).toBe('e-original');
  });

  it.each(['not_allowed', 'unknown_reference', 'rejected', 'unavailable'] as const)('passes the failure %s on', async (reason) => {
    const gw = fakeGateway({ status: 'failed', reason });
    expect(await createExpense(gw, command, NOW)).toEqual({ ok: false, kind: 'failed', reason });
  });

  it('treats a malformed project id as "not allowed" without calling the database', async () => {
    const gw = fakeGateway();
    expect(await createExpense(gw, { ...command, projectId: 'my-project' }, NOW)).toEqual({
      ok: false,
      kind: 'failed',
      reason: 'not_allowed',
    });
    expect(gw.createExpense).not.toHaveBeenCalled();
  });

  it('judges "the future" by the date in Libya, not in UTC', async () => {
    // 23:30 UTC on 16 Nov is already 17 Nov in Tripoli, so 17 Nov is "today" and is accepted.
    const lateEvening = new Date('2026-11-16T23:30:00Z');
    expect((await createExpense(fakeGateway(), { ...command, paidOn: '2026-11-17' }, lateEvening)).ok).toBe(true);
    // At 10:00 UTC the same date is still tomorrow in Tripoli and is refused.
    expect(await createExpense(fakeGateway(), { ...command, paidOn: '2026-11-17' }, NOW)).toEqual({
      ok: false,
      kind: 'invalid',
      errors: [{ field: 'paidOn', code: 'date_in_future' }],
    });
  });
});
