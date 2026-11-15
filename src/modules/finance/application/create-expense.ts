import { isUuid, toDb, todayInTripoli } from '@/shared-kernel';
import { validateNewExpense, type ExpenseError, type NewExpenseInput } from '../domain/expense';
import type { ExpenseFailure, ExpenseGateway } from './expense-gateway';

// Use case: record an expense (FR-FIN-02, UC-07). Runs on the SERVER. Order is always: validate in the domain
// (NFR-SEC-04), and call the database only when the input is valid. Nothing from the browser is trusted.

export interface CreateExpenseCommand extends NewExpenseInput {
  projectId: string;
}

export type CreateExpenseResult =
  /** duplicate = this exact request was already stored; the original expense is returned (NFR-REL-01). */
  | { ok: true; expenseId: string; duplicate: boolean }
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

  const valid = validateNewExpense(command, todayInTripoli(now));
  if (!valid.ok) return { ok: false, kind: 'invalid', errors: valid.errors };

  const outcome = await gateway.createExpense({
    projectId: command.projectId.toLowerCase(),
    amountLyd: toDb(valid.value.amountLyd),
    categoryId: valid.value.categoryId,
    phaseId: valid.value.phaseId,
    note: valid.value.note,
    paidOn: valid.value.paidOn,
    clientOpId: valid.value.clientOpId,
  });

  if (outcome.status === 'failed') return { ok: false, kind: 'failed', reason: outcome.reason };
  return { ok: true, expenseId: outcome.expenseId, duplicate: outcome.status === 'duplicate' };
}
