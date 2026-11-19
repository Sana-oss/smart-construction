import type { ExpenseType } from '../domain/expense';

// Port: what the expense use case needs from storage, in our own words. The Supabase adapter
// (infra/supabase-expense-gateway.ts) implements it; tests use a fake. Database error codes stay out of here.

export interface NewExpenseRecord {
  projectId: string;
  title: string;
  /** Money as a canonical decimal string ("12000.750"), never a JS number. */
  amountLyd: string;
  expenseType: ExpenseType;
  phaseId: string | null;
  payee: string | null;
  /** "YYYY-MM-DD", or null to let the database use today's date in Libya. */
  paidOn: string | null;
  clientOpId: string;
  /** "<project id>/receipts/<id>.jpg", already uploaded and checked, or null (no receipt photo). */
  receiptPath: string | null;
}

export type ExpenseFailure =
  | 'not_allowed' // not signed in, or no write access to this project
  | 'unknown_reference' // the phase does not belong to this project
  | 'rejected' // the database refused the values (its own double-check of the domain rules)
  | 'receipt_missing' // the receipt photo did not arrive in storage, or is not a JPEG within the size limit
  | 'not_found' // the expense does not exist in this project, or this user may not change it (RLS hides both)
  | 'unavailable';

export type CreateExpenseOutcome =
  | { status: 'created'; expenseId: string }
  /** The same request (same clientOpId) was stored before: nothing new was created (NFR-REL-01). */
  | { status: 'duplicate'; expenseId: string }
  | { status: 'failed'; reason: ExpenseFailure };

export interface ExpenseGateway {
  /** Stores the expense and its expense.created event in one transaction. */
  createExpense(expense: NewExpenseRecord): Promise<CreateExpenseOutcome>;
}

/** An edit of an existing expense, already validated (decision of 19 Nov 2026). */
export interface ExpenseChangeRecord {
  projectId: string;
  expenseId: string;
  title: string;
  /** Canonical decimal string ("12000.750"), never a JS number. */
  amountLyd: string;
  expenseType: ExpenseType;
  phaseId: string | null;
  payee: string | null;
  /** "YYYY-MM-DD" */
  paidOn: string;
}

export type ChangeExpenseOutcome = { status: 'done' } | { status: 'failed'; reason: ExpenseFailure };
export type DeleteExpenseOutcome =
  /** receiptPath: the receipt photo the deleted expense had, for the app to remove from storage. */
  | { status: 'done'; receiptPath: string | null }
  | { status: 'failed'; reason: ExpenseFailure };

/**
 * Port for editing and deleting. Separate from ExpenseGateway so recording an expense does not depend on it.
 * The database writes the audit row (with the old values) and the event in the same transaction (migration 0016).
 */
export interface ExpenseEditor {
  updateExpense(change: ExpenseChangeRecord): Promise<ChangeExpenseOutcome>;
  deleteExpense(projectId: string, expenseId: string): Promise<DeleteExpenseOutcome>;
}
