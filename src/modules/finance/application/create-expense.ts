import { IMAGE_MAX_STORED_BYTES, IMAGE_STORED_TYPE, isUuid, toDb, todayInTripoli } from '@/shared-kernel';
import type { FileStore } from '@/platform/supabase/storage';
import { isReceiptPathOf } from '../domain/receipt';
import { toForeignRecord, type ForeignRecord } from '../domain/currency';
import { validateNewExpense, type ExpenseError, type ExpenseType, type NewExpenseInput } from '../domain/expense';
import type { ExpenseFailure, ExpenseGateway } from './expense-gateway';

// Use case: record an expense (FR-FIN-02, UC-07). Runs on the SERVER. Order is always: validate in the domain
// (NFR-SEC-04), and call the database only when the input is valid. Nothing from the browser is trusted.

export interface CreateExpenseCommand extends NewExpenseInput {
  projectId: string;
  /** Optional receipt photo (UC-07), already uploaded by the browser: "<project id>/receipts/<id>.jpg". */
  receiptPath?: string | null;
}

/** The expense as it was stored, for the "saved" screen (design S14.2). */
export interface SavedExpense {
  expenseId: string;
  title: string;
  /** Canonical decimal string, e.g. "12000.000". */
  amountLyd: string;
  expenseType: ExpenseType;
  phaseId: string | null;
  payee: string | null;
  /** "YYYY-MM-DD": the date given, or today in Libya when none was given. */
  paidOn: string;
  hasReceipt: boolean;
  /** Paid in a foreign currency (3.18), or null. */
  foreign: ForeignRecord | null;
}

export type CreateExpenseResult =
  /** duplicate = this exact request was already stored; nothing new was created (NFR-REL-01). */
  | { ok: true; saved: SavedExpense; duplicate: boolean }
  | { ok: false; kind: 'invalid'; errors: ExpenseError[] }
  | { ok: false; kind: 'failed'; reason: ExpenseFailure };

/**
 * @param now The current moment; a parameter so tests can fix the clock.
 * @param store Private file storage, needed only when the command has a receipt photo. The browser uploads the photo
 *   BEFORE this runs, so every way this ends without a NEW expense removes it again: no file without an expense.
 */
export async function createExpense(
  gateway: ExpenseGateway,
  command: CreateExpenseCommand,
  now: Date = new Date(),
  store?: FileStore,
): Promise<CreateExpenseResult> {
  // A project id that is not an id cannot be anyone's project: same answer as "no access".
  if (!isUuid(command.projectId)) return { ok: false, kind: 'failed', reason: 'not_allowed' };
  const projectId = command.projectId.toLowerCase();

  const receiptPath = command.receiptPath?.trim() || null;
  // Only a path inside this project's receipts folder is ever looked at or removed (a browser could send any path).
  if (receiptPath !== null && (!store || !isReceiptPathOf(projectId, receiptPath))) {
    return { ok: false, kind: 'failed', reason: 'not_allowed' };
  }
  const dropReceipt = async () => {
    if (receiptPath !== null) await store!.remove([receiptPath]);
  };

  const today = todayInTripoli(now);
  const valid = validateNewExpense(command, today);
  if (!valid.ok) {
    await dropReceipt();
    return { ok: false, kind: 'invalid', errors: valid.errors };
  }
  const { title, expenseType, phaseId, payee, paidOn, clientOpId } = valid.value;
  const amountLyd = toDb(valid.value.amountLyd);
  const foreign = toForeignRecord(valid.value.foreign);

  if (receiptPath !== null) {
    const file = await store!.info(receiptPath);
    if (!file || file.contentType !== IMAGE_STORED_TYPE || file.sizeBytes > IMAGE_MAX_STORED_BYTES) {
      if (file) await dropReceipt();
      return { ok: false, kind: 'failed', reason: 'receipt_missing' };
    }
  }

  const outcome = await gateway.createExpense({
    projectId,
    title,
    amountLyd,
    expenseType,
    phaseId,
    payee,
    paidOn,
    clientOpId,
    receiptPath,
    foreign,
  });

  if (outcome.status === 'failed') {
    await dropReceipt();
    return { ok: false, kind: 'failed', reason: outcome.reason };
  }
  // A retried request: the expense was stored before, with whatever receipt it had then; this upload is not used.
  if (outcome.status === 'duplicate') await dropReceipt();
  return {
    ok: true,
    duplicate: outcome.status === 'duplicate',
    saved: {
      expenseId: outcome.expenseId,
      title,
      amountLyd,
      expenseType,
      phaseId,
      payee,
      paidOn: paidOn ?? today,
      hasReceipt: receiptPath !== null && outcome.status === 'created',
      foreign,
    },
  };
}
