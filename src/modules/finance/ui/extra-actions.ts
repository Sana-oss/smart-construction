'use server';

// Server Actions for extra works (FR-FIN-10). Run on the server as the signed-in user, under RLS. The project comes from
// the session, never from the form; the use cases check every value; the database audits every change (0022).

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { todayInTripoli } from '@/shared-kernel';
import { getMyProject } from '@/modules/projects';
import { createServerSupabase } from '@/platform/supabase/server';
import { addExtra, removeExtra, setExtraStatus } from '../application/extras';
import type { ExtraField } from '../domain/extras';
import { supabaseExtraStore } from '../infra/supabase-extra-store';
import { cashflowFailedAr, expenseErrorsAr } from './messages.ar';
import { EXTRAS_PATH } from './routes';

const FIELDS = ['title', 'cost', 'occurredOn', 'phaseId', 'status', 'note'] as const;

export interface ExtraFormState {
  fieldErrors?: Partial<Record<ExtraField, string>>;
  formError?: string;
  values?: Partial<Record<(typeof FIELDS)[number], string>>;
}

export async function addExtraAction(_prev: ExtraFormState, form: FormData): Promise<ExtraFormState> {
  const values = Object.fromEntries(FIELDS.map((k) => [k, String(form.get(k) ?? '')])) as Record<(typeof FIELDS)[number], string>;
  const project = await getMyProject();
  if (!project) return { formError: cashflowFailedAr.no_project, values };
  // The phase must be one of this project's (the database checks again, 0022).
  if (values.phaseId && !project.phases.some((p) => p.id === values.phaseId.trim().toLowerCase())) {
    return { fieldErrors: { phaseId: expenseErrorsAr.unknown_choice }, values };
  }
  const result = await addExtra(supabaseExtraStore(await createServerSupabase()), { ...values, projectId: project.id }, todayInTripoli());
  if (!result.ok) {
    if (result.kind === 'failed') return { formError: cashflowFailedAr[result.reason], values };
    const fieldErrors: ExtraFormState['fieldErrors'] = {};
    for (const e of result.errors) fieldErrors[e.field] ??= expenseErrorsAr[e.code];
    return { fieldErrors, values };
  }
  revalidatePath('/', 'layout');
  redirect(`${EXTRAS_PATH}?done=added`);
}

/** Bound to one row and one status: approve, or reject. */
export async function setExtraStatusAction(id: string, status: string): Promise<void> {
  const project = await getMyProject();
  if (!project) redirect(EXTRAS_PATH);
  const result = await setExtraStatus(supabaseExtraStore(await createServerSupabase()), { projectId: project.id, id, status });
  revalidatePath('/', 'layout');
  redirect(result.ok ? `${EXTRAS_PATH}?done=changed` : EXTRAS_PATH);
}

export async function deleteExtraAction(id: string): Promise<void> {
  const project = await getMyProject();
  if (!project) redirect(EXTRAS_PATH);
  const result = await removeExtra(supabaseExtraStore(await createServerSupabase()), { projectId: project.id, id });
  revalidatePath('/', 'layout');
  redirect(result.ok ? `${EXTRAS_PATH}?done=deleted` : EXTRAS_PATH);
}
