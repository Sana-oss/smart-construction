import { describe, expect, it, vi } from 'vitest';
import { createExpense, type CreateExpenseCommand } from './create-expense';
import type { CreateExpenseOutcome, ExpenseGateway } from './expense-gateway';

const PROJECT = '11111111-1111-4111-8111-111111111111';
const OP = '33333333-3333-4333-8333-333333333333';
const NOW = new Date('2026-11-16T10:00:00Z');

function fakeGateway(outcome: CreateExpenseOutcome = { status: 'created', expenseId: 'e1' }) {
  const gateway: ExpenseGateway = { createExpense: vi.fn(async () => outcome) };
  return gateway;
}

const command: CreateExpenseCommand = { projectId: PROJECT, amount: '٢٬٥٠٠٫٧٥', clientOpId: OP };

describe('createExpense', () => {
  it('sends the validated expense with the amount as a decimal string', async () => {
    const gw = fakeGateway();
    expect(await createExpense(gw, { ...command, note: ' حديد ', paidOn: '2026-11-10' }, NOW)).toEqual({
      ok: true,
      expenseId: 'e1',
      duplicate: false,
    });
    expect(gw.createExpense).toHaveBeenCalledWith({
      projectId: PROJECT,
      amountLyd: '2500.750',
      categoryId: null,
      phaseId: null,
      note: 'حديد',
      paidOn: '2026-11-10',
      clientOpId: OP,
    });
  });

  it('never calls the database when the input is invalid', async () => {
    const gw = fakeGateway();
    expect(await createExpense(gw, { ...command, amount: '0' }, NOW)).toEqual({
      ok: false,
      kind: 'invalid',
      errors: [{ field: 'amount', code: 'must_be_positive' }],
    });
    expect(gw.createExpense).not.toHaveBeenCalled();
  });

  it('reports a repeated request as a success with the original expense (NFR-REL-01)', async () => {
    const gw = fakeGateway({ status: 'duplicate', expenseId: 'e-original' });
    expect(await createExpense(gw, command, NOW)).toEqual({ ok: true, expenseId: 'e-original', duplicate: true });
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
    const gw = fakeGateway();
    expect((await createExpense(gw, { ...command, paidOn: '2026-11-17' }, lateEvening)).ok).toBe(true);
    // At 10:00 UTC the same date is still tomorrow in Tripoli and is refused.
    expect(await createExpense(fakeGateway(), { ...command, paidOn: '2026-11-17' }, NOW)).toEqual({
      ok: false,
      kind: 'invalid',
      errors: [{ field: 'paidOn', code: 'date_in_future' }],
    });
  });
});
