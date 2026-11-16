import { isUuid, toDb, todayInTripoli } from '@/shared-kernel';
import { validateNewExpense, type ExpenseError, type ExpenseType, type NewExpenseInput } from '../domain/expense';
import type { ExpenseFailure, ExpenseGateway } from './expense-gateway';

// Use case: record an expense (FR-FIN-02, UC-07). Runs on the SERVER. Order is always: validate in the domain
// (NFR-SEC-04), and call the database only when the input is valid. Nothing from the browser is trusted.

export interface CreateExpenseCommand extends NewExpenseInput {
  projectId: string;
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
}

export type CreateExpenseResult =
  /** duplicate = this exact request was already stored; nothing new was created (NFR-REL-01). */
  | { ok: true; saved: SavedExpense; duplicate: boolean }
  | { ok: false; kind: 'invalid'; errors: ExpenseError[] }
  | { ok: false; kind: 'failed'; reason: ExpenseFailure };

/** @param now The current moment; a parameter so tests can fix the clock. */
export async function createExpense(
  gateway: ExpenseGateway,
  command: CreateExpenseCommand,
  now: Date = new Date(),
): Promise<CreateExpenseResult> {
  // A project id that is not an id cannot be anyone's project: same answer as "no access".
  if (!isUuid(command.projectId)) return { ok: false, kind: 'failed', reason: 'not_allowed' };

  const today = todayInTripoli(now);
  const valid = validateNewExpense(command, today);
  if (!valid.ok) return { ok: false, kind: 'invalid', errors: valid.errors };
  const { title, expenseType, phaseId, payee, paidOn, clientOpId } = valid.value;
  const amountLyd = toDb(valid.value.amountLyd);

  const outcome = await gateway.createExpense({
    projectId: command.projectId.toLowerCase(),
    title,
    amountLyd,
    expenseType,
    phaseId,
    payee,
    paidOn,
    clientOpId,
  });

  if (outcome.status === 'failed') return { ok: false, kind: 'failed', reason: outcome.reason };
  return {
    ok: true,
    duplicate: outcome.status === 'duplicate',
    saved: { expenseId: outcome.expenseId, title, amountLyd, expenseType, phaseId, payee, paidOn: paidOn ?? today },
  };
}
