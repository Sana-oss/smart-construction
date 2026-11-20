'use server';

// Server Action for the quick-expense screen (FR-FIN-02, design S14.1). Built for React's useActionState: it
// receives the previous state and the form data, and returns a new state with Arabic messages or the saved
// expense. It runs only on the server, as the signed-in user, under RLS (no service-role key). What the browser
// sends is validated again by the domain rules inside the use case; nothing is trusted as it is.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getMyProject } from '@/modules/projects';
import { createServerSupabase } from '@/platform/supabase/server';
import { supabaseFileStore } from '@/platform/supabase/storage';
import { receiptStoragePath } from '../domain/receipt';
import type { ExpenseError } from '../domain/expense';
import { deleteExpense, updateExpense } from '../application/change-expense';
import { createExpense, type SavedExpense } from '../application/create-expense';
import { supabaseExpenseEditor, supabaseExpenseGateway } from '../infra/supabase-expense-gateway';
import { EXPENSE_VALUE_FIELDS, type ExpenseFormValues, type ExpenseValueField } from './expense-form-values';
import { currencyTextAr, expenseChangeFailedAr, expenseErrorsAr, expenseFailedAr, type ExpenseFieldErrors } from './messages.ar';
import { EXPENSES_PATH } from './routes';


export interface ExpenseFormState {
  /** Message per field, shown under the input. */
  fieldErrors?: ExpenseFieldErrors;
  /** Message for the whole form (no access, connection problem, ...). */
  formError?: string;
  /** What the owner typed, sent back after an error so the form shows it again (React resets the form). */
  values?: ExpenseFormValues;
  /** Set when the expense was stored: the screen then shows "saved" (design S14.2). */
  saved?: SavedExpense & { duplicate: boolean };
}

const text = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === 'string' ? v : '';
};
const readValues = (form: FormData) =>
  Object.fromEntries(EXPENSE_VALUE_FIELDS.map((k) => [k, text(form, k)])) as Record<ExpenseValueField, string>;

/** Domain errors -> one Arabic message per field (the first error of each field). */
function fieldErrorsOf(errors: ExpenseError[]): ExpenseFieldErrors {
  const out: ExpenseFieldErrors = {};
  for (const e of errors) out[e.field] ??= e.field === 'rate' && e.code === 'invalid_number' ? currencyTextAr.rateInvalid : expenseErrorsAr[e.code];
  return out;
}

export async function createExpenseAction(_prev: ExpenseFormState, form: FormData): Promise<ExpenseFormState> {
  const values = readValues(form);

  // The project is read on the server from the signed-in user, never taken from the form.
  const project = await getMyProject();
  if (!project) return { formError: expenseFailedAr.no_project, values };

  const supabase = await createServerSupabase();
  const result = await createExpense(
    supabaseExpenseGateway(supabase),
    { ...values, projectId: project.id, clientOpId: text(form, 'clientOpId'), receiptPath: text(form, 'receiptPath') || null },
    new Date(),
    supabaseFileStore(supabase),
  );

  if (!result.ok) {
    if (result.kind === 'failed') return { formError: expenseFailedAr[result.reason], values };
    const fieldErrors = fieldErrorsOf(result.errors);
    // clientOpId is made by the page, not typed: if it is wrong the owner can only try again.
    return { fieldErrors, formError: fieldErrors.clientOpId ? expenseFailedAr.rejected : undefined, values };
  }

  // The dashboard total changed: render it again on the next visit.
  revalidatePath('/', 'layout');
  return { saved: { ...result.saved, duplicate: result.duplicate } };
}

export type ReceiptTicket = { ok: true; path: string; token: string } | { ok: false; message: string };

/**
 * Receipt photo, step 1 (UC-07): a fresh path in the owner's receipts folder and a one-time upload token. The storage
 * policies of 0013 refuse the token to anyone who may not write to the project. The browser then uploads, and
 * createExpenseAction checks the file and records it with the expense.
 */
export async function prepareReceiptUploadAction(): Promise<ReceiptTicket> {
  const project = await getMyProject();
  if (!project) return { ok: false, message: expenseFailedAr.no_project };
  const path = receiptStoragePath(project.id, crypto.randomUUID());
  const ticket = await supabaseFileStore(await createServerSupabase()).uploadTicket(path);
  return ticket ? { ok: true, path, token: ticket.token } : { ok: false, message: expenseFailedAr.not_allowed };
}

/**
 * Edit one expense (decision of 19 Nov 2026). The expense id comes from the form, but the PROJECT comes from the
 * signed-in user, and RLS only matches an expense of a project this user may write: a foreign id finds nothing.
 * On success, back to the list with a notice; the database has already written the audit row (0016).
 */
export async function updateExpenseAction(_prev: ExpenseFormState, form: FormData): Promise<ExpenseFormState> {
  const values = readValues(form);
  const project = await getMyProject();
  if (!project) return { formError: expenseChangeFailedAr.no_project, values };

  const supabase = await createServerSupabase();
  const result = await updateExpense(supabaseExpenseEditor(supabase), {
    ...values,
    projectId: project.id,
    expenseId: text(form, 'expenseId'),
  });
  if (!result.ok) {
    if (result.kind === 'failed') return { formError: expenseChangeFailedAr[result.reason], values };
    return { fieldErrors: fieldErrorsOf(result.errors), values };
  }

  revalidatePath('/', 'layout'); // totals on the dashboard and the list changed
  redirect(`${EXPENSES_PATH}?done=updated`);
}

export interface DeleteExpenseState {
  formError?: string;
}

/** Delete one expense and its receipt photo (decision of 19 Nov 2026: the audit log keeps the old values). */
export async function deleteExpenseAction(_prev: DeleteExpenseState, form: FormData): Promise<DeleteExpenseState> {
  const project = await getMyProject();
  if (!project) return { formError: expenseChangeFailedAr.no_project };

  const supabase = await createServerSupabase();
  const result = await deleteExpense(
    supabaseExpenseEditor(supabase),
    { projectId: project.id, expenseId: text(form, 'expenseId') },
    supabaseFileStore(supabase),
  );
  if (!result.ok) return { formError: expenseChangeFailedAr[result.reason] };

  revalidatePath('/', 'layout');
  redirect(`${EXPENSES_PATH}?done=deleted`);
}
