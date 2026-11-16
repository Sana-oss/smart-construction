'use server';

// Server Action for the quick-expense screen (FR-FIN-02, design S14.1). Built for React's useActionState: it
// receives the previous state and the form data, and returns a new state with Arabic messages or the saved
// expense. It runs only on the server, as the signed-in user, under RLS (no service-role key). What the browser
// sends is validated again by the domain rules inside the use case; nothing is trusted as it is.

import { revalidatePath } from 'next/cache';
import { getMyProject } from '@/modules/projects';
import { createServerSupabase } from '@/platform/supabase/server';
import { createExpense, type SavedExpense } from '../application/create-expense';
import { supabaseExpenseGateway } from '../infra/supabase-expense-gateway';
import { expenseErrorsAr, expenseFailedAr, type ExpenseFieldErrors } from './messages.ar';

const VALUE_FIELDS = ['title', 'amount', 'expenseType', 'phaseId', 'payee', 'paidOn'] as const;
type ValueField = (typeof VALUE_FIELDS)[number];

export interface ExpenseFormState {
  /** Message per field, shown under the input. */
  fieldErrors?: ExpenseFieldErrors;
  /** Message for the whole form (no access, connection problem, ...). */
  formError?: string;
  /** What the owner typed, sent back after an error so the form shows it again (React resets the form). */
  values?: Partial<Record<ValueField, string>>;
  /** Set when the expense was stored: the screen then shows "saved" (design S14.2). */
  saved?: SavedExpense & { duplicate: boolean };
}

const text = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === 'string' ? v : '';
};

export async function createExpenseAction(_prev: ExpenseFormState, form: FormData): Promise<ExpenseFormState> {
  const values = Object.fromEntries(VALUE_FIELDS.map((k) => [k, text(form, k)])) as Record<ValueField, string>;

  // The project is read on the server from the signed-in user, never taken from the form.
  const project = await getMyProject();
  if (!project) return { formError: expenseFailedAr.no_project, values };

  const gateway = supabaseExpenseGateway(await createServerSupabase());
  const result = await createExpense(gateway, { ...values, projectId: project.id, clientOpId: text(form, 'clientOpId') });

  if (!result.ok) {
    if (result.kind === 'failed') return { formError: expenseFailedAr[result.reason], values };
    const fieldErrors: ExpenseFieldErrors = {};
    for (const e of result.errors) fieldErrors[e.field] ??= expenseErrorsAr[e.code]; // first error per field
    // clientOpId is made by the page, not typed: if it is wrong the owner can only try again.
    return { fieldErrors, formError: fieldErrors.clientOpId ? expenseFailedAr.rejected : undefined, values };
  }

  // The dashboard total changed: render it again on the next visit.
  revalidatePath('/', 'layout');
  return { saved: { ...result.saved, duplicate: result.duplicate } };
}
