import { describe, expect, it, vi } from 'vitest';
import type { FileStore } from '@/platform/supabase/storage';
import { deleteExpense, updateExpense, type UpdateExpenseCommand } from './change-expense';
import type { ChangeExpenseOutcome, DeleteExpenseOutcome, ExpenseEditor } from './expense-gateway';

const PROJECT = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const EXPENSE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const PHASE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const NOW = new Date('2026-11-16T10:00:00Z');
const RECEIPT = `${PROJECT}/receipts/f0000000-0000-4000-8000-000000000001.jpg`;

function fakeEditor(
  update: ChangeExpenseOutcome = { status: 'done' },
  del: DeleteExpenseOutcome = { status: 'done', receiptPath: null },
) {
  const editor: ExpenseEditor = { updateExpense: vi.fn(async () => update), deleteExpense: vi.fn(async () => del) };
  return editor;
}

function fakeStore(remove: FileStore['remove'] = async () => undefined) {
  const store: FileStore = {
    uploadTicket: vi.fn(),
    info: vi.fn(),
    signedUrls: vi.fn(),
    remove: vi.fn(remove),
  };
  return store;
}

const command: UpdateExpenseCommand = {
  projectId: PROJECT,
  expenseId: EXPENSE.toUpperCase(),
  title: ' حديد  تسليح ',
  amount: '١٢٬٥٠٠٫٥',
  expenseType: 'materials',
  phaseId: PHASE,
  payee: '',
  paidOn: '2026-11-10',
};

describe('updateExpense', () => {
  it('sends the validated edit with the amount as a decimal string', async () => {
    const editor = fakeEditor();
    expect(await updateExpense(editor, command, NOW)).toEqual({ ok: true });
    expect(editor.updateExpense).toHaveBeenCalledWith({
      projectId: PROJECT,
      expenseId: EXPENSE,
      title: 'حديد تسليح',
      amountLyd: '12500.500',
      expenseType: 'materials',
      phaseId: PHASE,
      payee: null,
      paidOn: '2026-11-10',
      foreign: null,
    });
  });

  it('never calls the database when the input is invalid', async () => {
    const editor = fakeEditor();
    expect(await updateExpense(editor, { ...command, paidOn: '2026-11-17' }, NOW)).toEqual({
      ok: false,
      kind: 'invalid',
      errors: [{ field: 'paidOn', code: 'date_in_future' }],
    });
    expect(editor.updateExpense).not.toHaveBeenCalled();
  });

  it('answers "not found" for ids that are not ids, without calling the database', async () => {
    const editor = fakeEditor();
    expect(await updateExpense(editor, { ...command, expenseId: '1 or 1=1' }, NOW)).toEqual({ ok: false, kind: 'failed', reason: 'not_found' });
    expect(await updateExpense(editor, { ...command, projectId: 'x' }, NOW)).toEqual({ ok: false, kind: 'failed', reason: 'not_found' });
    expect(editor.updateExpense).not.toHaveBeenCalled();
  });

  it('passes on what the database refused', async () => {
    const editor = fakeEditor({ status: 'failed', reason: 'unknown_reference' });
    expect(await updateExpense(editor, command, NOW)).toEqual({ ok: false, kind: 'failed', reason: 'unknown_reference' });
  });
});

describe('deleteExpense', () => {
  it('deletes the expense, then removes its receipt photo', async () => {
    const editor = fakeEditor(undefined, { status: 'done', receiptPath: RECEIPT });
    const store = fakeStore();
    expect(await deleteExpense(editor, { projectId: PROJECT, expenseId: EXPENSE }, store)).toEqual({ ok: true });
    expect(editor.deleteExpense).toHaveBeenCalledWith(PROJECT, EXPENSE);
    expect(store.remove).toHaveBeenCalledWith([RECEIPT]);
  });

  it('removes nothing when the expense had no receipt', async () => {
    const store = fakeStore();
    expect(await deleteExpense(fakeEditor(), { projectId: PROJECT, expenseId: EXPENSE }, store)).toEqual({ ok: true });
    expect(store.remove).not.toHaveBeenCalled();
  });

  it('keeps every file when the deletion fails', async () => {
    const editor = fakeEditor(undefined, { status: 'failed', reason: 'not_found' });
    const store = fakeStore();
    expect(await deleteExpense(editor, { projectId: PROJECT, expenseId: EXPENSE }, store)).toEqual({ ok: false, reason: 'not_found' });
    expect(store.remove).not.toHaveBeenCalled();
  });

  it('never removes a path outside this project\'s receipts folder', async () => {
    const outside = `${OTHER}/receipts/f0000000-0000-4000-8000-000000000001.jpg`;
    const store = fakeStore();
    await deleteExpense(fakeEditor(undefined, { status: 'done', receiptPath: outside }), { projectId: PROJECT, expenseId: EXPENSE }, store);
    expect(store.remove).not.toHaveBeenCalled();
  });

  it('still reports success when the photo cannot be removed (the expense is already gone)', async () => {
    const editor = fakeEditor(undefined, { status: 'done', receiptPath: RECEIPT });
    const store = fakeStore(async () => {
      throw new Error('storage down');
    });
    expect(await deleteExpense(editor, { projectId: PROJECT, expenseId: EXPENSE }, store)).toEqual({ ok: true });
  });

  it('answers "not found" for ids that are not ids, without calling the database', async () => {
    const editor = fakeEditor();
    expect(await deleteExpense(editor, { projectId: PROJECT, expenseId: '' }, fakeStore())).toEqual({ ok: false, reason: 'not_found' });
    expect(editor.deleteExpense).not.toHaveBeenCalled();
  });
});
