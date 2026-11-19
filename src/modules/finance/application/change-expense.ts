import { isUuid, toDb, todayInTripoli } from '@/shared-kernel';
import type { FileStore } from '@/platform/supabase/storage';
import { validateExpenseEdit, type ExpenseError, type ExpenseEditInput } from '../domain/expense';
import { isReceiptPathOf } from '../domain/receipt';
import type { ExpenseEditor, ExpenseFailure } from './expense-gateway';

// Use cases: edit and delete an expense (decision of 19 Nov 2026, change register; FR-SYS-03 for the audit log).
// Run on the SERVER as the signed-in user. The database itself writes the audit row for every change and every
// deletion, with the old values (migration 0016), so nothing here can forget it.

export interface UpdateExpenseCommand extends ExpenseEditInput {
  projectId: string;
  expenseId: string;
}

export type UpdateExpenseResult =
  | { ok: true }
  | { ok: false; kind: 'invalid'; errors: ExpenseError[] }
  | { ok: false; kind: 'failed'; reason: ExpenseFailure };

/** Ids that are not ids cannot name anyone's expense: the same answer as "not found" (nothing is revealed). */
function ids(projectId: string, expenseId: string) {
  return isUuid(projectId) && isUuid(expenseId) ? { projectId: projectId.toLowerCase(), expenseId: expenseId.toLowerCase() } : null;
}

/** @param now The current moment; a parameter so tests can fix the clock. */
export async function updateExpense(
  editor: ExpenseEditor,
  command: UpdateExpenseCommand,
  now: Date = new Date(),
): Promise<UpdateExpenseResult> {
  const target = ids(command.projectId, command.expenseId);
  if (!target) return { ok: false, kind: 'failed', reason: 'not_found' };

  const valid = validateExpenseEdit(command, todayInTripoli(now));
  if (!valid.ok) return { ok: false, kind: 'invalid', errors: valid.errors };
  const { title, expenseType, phaseId, payee, paidOn } = valid.value;

  const outcome = await editor.updateExpense({
    ...target,
    title,
    amountLyd: toDb(valid.value.amountLyd),
    expenseType,
    phaseId,
    payee,
    paidOn,
  });
  return outcome.status === 'done' ? { ok: true } : { ok: false, kind: 'failed', reason: outcome.reason };
}

export type DeleteExpenseResult = { ok: true } | { ok: false; reason: ExpenseFailure };

/**
 * Deletes the expense, then its receipt photo (decision of 19 Nov 2026: the row and the file go; the audit log
 * keeps the old values). The file is removed only AFTER the row is gone, and only if it is in this project's
 * receipts folder: a failed deletion never loses a receipt that still belongs to an expense.
 */
export async function deleteExpense(
  editor: ExpenseEditor,
  command: { projectId: string; expenseId: string },
  store: FileStore,
): Promise<DeleteExpenseResult> {
  const target = ids(command.projectId, command.expenseId);
  if (!target) return { ok: false, reason: 'not_found' };

  const outcome = await editor.deleteExpense(target.projectId, target.expenseId);
  if (outcome.status === 'failed') return { ok: false, reason: outcome.reason };

  const path = outcome.receiptPath;
  if (path !== null && isReceiptPathOf(target.projectId, path)) {
    // The expense is already deleted: a storage error must not turn that into a failure on screen. A file left
    // behind is private and harmless; it can be found by the query in scripts/e2e-cleanup.sql's header.
    await store.remove([path]).catch(() => undefined);
  }
  return { ok: true };
}
