import { describe, expect, it, vi } from 'vitest';
import { createExpense, type CreateExpenseCommand } from './create-expense';
import type { FileStore } from '@/platform/supabase/storage';
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
    expect(gw.createExpense).toHaveBeenCalledWith({ projectId: PROJECT, clientOpId: OP, receiptPath: null, ...stored });
    expect(result).toEqual({ ok: true, duplicate: false, saved: { expenseId: 'e1', hasReceipt: false, ...stored } });
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

  describe('with a receipt photo (UC-07)', () => {
    const RECEIPT = `${PROJECT}/receipts/44444444-4444-4444-8444-444444444444.jpg`;
    const store = (info: Awaited<ReturnType<FileStore['info']>> = { sizeBytes: 180_000, contentType: 'image/jpeg' }) => {
      const s: FileStore = {
        uploadTicket: vi.fn(async () => ({ token: 't' })),
        info: vi.fn(async () => info),
        signedUrls: vi.fn(async () => new Map()),
        remove: vi.fn(async () => {}),
      };
      return s;
    };

    it('stores the checked receipt with the expense', async () => {
      const gw = fakeGateway();
      const files = store();
      const r = await createExpense(gw, { ...command, receiptPath: RECEIPT }, NOW, files);
      expect(gw.createExpense).toHaveBeenCalledWith(expect.objectContaining({ receiptPath: RECEIPT }));
      expect(r.ok && r.saved.hasReceipt).toBe(true);
      expect(files.remove).not.toHaveBeenCalled();
    });

    it("refuses a receipt outside the project's receipts folder, without touching storage", async () => {
      const files = store();
      const r = await createExpense(fakeGateway(), { ...command, receiptPath: `${PROJECT}/photos/x.jpg` }, NOW, files);
      expect(r).toEqual({ ok: false, kind: 'failed', reason: 'not_allowed' });
      expect(files.remove).not.toHaveBeenCalled();
    });

    it('reports a receipt that never arrived, and removes one that is too big or not a JPEG', async () => {
      const missing = await createExpense(fakeGateway(), { ...command, receiptPath: RECEIPT }, NOW, store(null));
      expect(missing).toEqual({ ok: false, kind: 'failed', reason: 'receipt_missing' });
      const big = store({ sizeBytes: 9_000_000, contentType: 'image/jpeg' });
      const r = await createExpense(fakeGateway(), { ...command, receiptPath: RECEIPT }, NOW, big);
      expect(r).toEqual({ ok: false, kind: 'failed', reason: 'receipt_missing' });
      expect(big.remove).toHaveBeenCalledWith([RECEIPT]);
    });

    it('removes the uploaded receipt when the form is invalid, the database refuses, or the expense was already stored', async () => {
      const a = store();
      await createExpense(fakeGateway(), { ...command, title: '', receiptPath: RECEIPT }, NOW, a);
      expect(a.remove).toHaveBeenCalledWith([RECEIPT]);

      const b = store();
      await createExpense(fakeGateway({ status: 'failed', reason: 'rejected' }), { ...command, receiptPath: RECEIPT }, NOW, b);
      expect(b.remove).toHaveBeenCalledWith([RECEIPT]);

      // A retried request (same client_op_id): the stored expense keeps whatever it had; the new upload goes.
      const c = store();
      const r = await createExpense(fakeGateway({ status: 'duplicate', expenseId: 'e1' }), { ...command, receiptPath: RECEIPT }, NOW, c);
      expect(c.remove).toHaveBeenCalledWith([RECEIPT]);
      expect(r.ok && r.duplicate).toBe(true);
    });
  });
});
