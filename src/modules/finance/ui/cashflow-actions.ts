'use server';

// Server Actions for obligations and expected income (design S16.2, and deleting from S16.1). Run on the server as the
// signed-in user, under RLS. The project comes from the session, never from the form; the use case checks every value.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getMyProject } from '@/modules/projects';
import { createServerSupabase } from '@/platform/supabase/server';
import { addMovement, removeMovement } from '../application/cashflow';
import type { MovementField } from '../domain/cashflow';
import { supabaseCashflowStore } from '../infra/supabase-cashflow-store';
import { cashflowFailedAr, expenseErrorsAr } from './messages.ar';
import { CASHFLOW_PATH } from './routes';

const FIELDS = ['kind', 'title', 'amount', 'date', 'party'] as const;

export interface MovementFormState {
  fieldErrors?: Partial<Record<MovementField, string>>;
  formError?: string;
  /** What the owner typed, sent back after an error (React resets the form). */
  values?: Partial<Record<(typeof FIELDS)[number], string>>;
}

export async function addMovementAction(_prev: MovementFormState, form: FormData): Promise<MovementFormState> {
  const values = Object.fromEntries(FIELDS.map((k) => [k, String(form.get(k) ?? '')])) as Record<(typeof FIELDS)[number], string>;
  const project = await getMyProject();
  if (!project) return { formError: cashflowFailedAr.no_project, values };

  const result = await addMovement(supabaseCashflowStore(await createServerSupabase()), { ...values, projectId: project.id });
  if (!result.ok) {
    if (result.kind === 'failed') return { formError: cashflowFailedAr[result.reason], values };
    const fieldErrors: MovementFormState['fieldErrors'] = {};
    for (const e of result.errors) fieldErrors[e.field] ??= expenseErrorsAr[e.code];
    return { fieldErrors, values };
  }
  revalidatePath(CASHFLOW_PATH);
  redirect(`${CASHFLOW_PATH}?done=added`);
}

/** Bound to one row: deleteMovementAction.bind(null, kind, id). The database audits the deletion (0017). */
export async function deleteMovementAction(kind: string, id: string): Promise<void> {
  const project = await getMyProject();
  if (!project) redirect(CASHFLOW_PATH);
  const result = await removeMovement(supabaseCashflowStore(await createServerSupabase()), { projectId: project.id, kind, id });
  revalidatePath(CASHFLOW_PATH);
  redirect(result.ok ? `${CASHFLOW_PATH}?done=deleted` : CASHFLOW_PATH);
}
