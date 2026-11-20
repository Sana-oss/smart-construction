'use server';

// Server Action for the budget plan (S15.2's form). Runs on the server as the signed-in user, under RLS. The project and
// its phases come from the session (projects module), never from the form.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getMyProject } from '@/modules/projects';
import { createServerSupabase } from '@/platform/supabase/server';
import { saveAllocations } from '../application/budget-plan';
import { supabaseBudgetStore } from '../infra/supabase-budget-store';
import { cashflowFailedAr, expenseErrorsAr } from './messages.ar';
import { ALLOCATION_FIELD_PREFIX } from './allocation-field';
import { BUDGET_PHASES_PATH } from './routes';

export interface AllocationFormState {
  /** phase id -> message */
  fieldErrors?: Record<string, string>;
  formError?: string;
  /** phase id -> what the owner typed, sent back after an error. */
  values?: Record<string, string>;
}

export async function saveAllocationsAction(_prev: AllocationFormState, form: FormData): Promise<AllocationFormState> {
  const values: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (k.startsWith(ALLOCATION_FIELD_PREFIX)) values[k.slice(ALLOCATION_FIELD_PREFIX.length)] = String(v);
  const project = await getMyProject();
  if (!project) return { formError: cashflowFailedAr.no_project, values };
  const result = await saveAllocations(
    supabaseBudgetStore(await createServerSupabase()),
    { projectId: project.id, allocations: values },
    project.phases.map((p) => p.id),
  );
  if (!result.ok) {
    if (result.kind === 'failed') return { formError: cashflowFailedAr[result.reason], values };
    const fieldErrors: Record<string, string> = {};
    for (const e of result.errors) fieldErrors[e.phaseId] ??= expenseErrorsAr[e.code];
    return { fieldErrors, values };
  }
  revalidatePath('/', 'layout');
  redirect(`${BUDGET_PHASES_PATH}?done=saved`);
}
