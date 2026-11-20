'use server';

// Server Actions for the reference rates log (3.18). Run on the server as the signed-in user, under RLS. The project
// comes from the session, never from the form; the use case checks every value.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { todayInTripoli } from '@/shared-kernel';
import { getMyProject } from '@/modules/projects';
import { createServerSupabase } from '@/platform/supabase/server';
import { addRate, removeRate } from '../application/rates';
import type { RateField } from '../domain/currency';
import { supabaseRateStore } from '../infra/supabase-rate-store';
import { cashflowFailedAr, currencyTextAr, expenseErrorsAr } from './messages.ar';
import { RATES_PATH } from './routes';

const FIELDS = ['currency', 'rate', 'rateDate', 'note'] as const;

export interface RateFormState {
  fieldErrors?: Partial<Record<RateField, string>>;
  formError?: string;
  values?: Partial<Record<(typeof FIELDS)[number], string>>;
}

export async function addRateAction(_prev: RateFormState, form: FormData): Promise<RateFormState> {
  const values = Object.fromEntries(FIELDS.map((k) => [k, String(form.get(k) ?? '')])) as Record<(typeof FIELDS)[number], string>;
  const project = await getMyProject();
  if (!project) return { formError: cashflowFailedAr.no_project, values };
  const result = await addRate(supabaseRateStore(await createServerSupabase()), { ...values, projectId: project.id }, todayInTripoli());
  if (!result.ok) {
    if (result.kind === 'failed') return { formError: cashflowFailedAr[result.reason], values };
    const fieldErrors: RateFormState['fieldErrors'] = {};
    for (const e of result.errors) fieldErrors[e.field] ??= e.field === 'rate' && e.code === 'invalid_number' ? currencyTextAr.rateInvalid : expenseErrorsAr[e.code];
    return { fieldErrors, values };
  }
  revalidatePath('/', 'layout'); // the expense forms start with the latest rate
  redirect(`${RATES_PATH}?done=added`);
}

/** Bound to one row. The database audits the deletion (0020); no expense changes. */
export async function deleteRateAction(id: string): Promise<void> {
  const project = await getMyProject();
  if (!project) redirect(RATES_PATH);
  const result = await removeRate(supabaseRateStore(await createServerSupabase()), { projectId: project.id, id });
  revalidatePath('/', 'layout');
  redirect(result.ok ? `${RATES_PATH}?done=deleted` : RATES_PATH);
}
