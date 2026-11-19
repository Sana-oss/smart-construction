import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreateExpenseOutcome, ExpenseFailure, ExpenseGateway } from '../application/expense-gateway';

/**
 * Translates PostgreSQL error codes into our own failure reasons, so a raw database message never reaches the
 * user (NFR-USE-04). Codes raised by create_expense (migration 0009) and by the table's rules:
 *   42501 insufficient privilege: not signed in, or RLS refused the insert (no write access to the project)
 *   23503 foreign key violation:  the phase does not belong to this project
 *   23514 check violation:        amount not positive, future date, missing name, type or client_op_id
 *   22003 numeric out of range:   amount too large for numeric(14,3)
 */
export function mapExpenseError(error: { code?: string }): ExpenseFailure {
  switch (error.code) {
    case '42501':
      return 'not_allowed';
    case '23503':
      return 'unknown_reference';
    case '23505': // the same receipt file on two expenses (0015)
    case '23514':
    case '22003':
      return 'rejected';
    default:
      return 'unavailable';
  }
}

/** Supabase adapter. Always used with the signed-in user's client, so RLS decides who may write. */
export function supabaseExpenseGateway(supabase: SupabaseClient): ExpenseGateway {
  return {
    async createExpense(e): Promise<CreateExpenseOutcome> {
      // One database function = one transaction: the expense and its expense.created event (0009).
      const { data, error } = await supabase.rpc('create_expense', {
        p_project_id: e.projectId,
        p_amount_lyd: e.amountLyd, // a decimal string; PostgreSQL reads it as numeric, no JS number involved
        p_client_op_id: e.clientOpId,
        p_title: e.title,
        p_expense_type: e.expenseType,
        p_phase_id: e.phaseId,
        p_payee: e.payee,
        p_paid_on: e.paidOn,
        p_receipt_path: e.receiptPath,
      });
      if (error) return { status: 'failed', reason: mapExpenseError(error) };

      // The function returns one row: { expense_id, created }.
      const row = (Array.isArray(data) ? data[0] : data) as { expense_id?: unknown; created?: unknown } | null;
      if (!row || typeof row.expense_id !== 'string') return { status: 'failed', reason: 'unavailable' };
      return { status: row.created === true ? 'created' : 'duplicate', expenseId: row.expense_id };
    },
  };
}
