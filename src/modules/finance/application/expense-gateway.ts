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
}

export type ExpenseFailure =
  | 'not_allowed' // not signed in, or no write access to this project
  | 'unknown_reference' // the phase does not belong to this project
  | 'rejected' // the database refused the values (its own double-check of the domain rules)
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
