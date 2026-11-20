'use server';

// Server Actions for the concrete log (FR-QLT-04, FR-QLT-05). Run on the server as the signed-in user, under RLS. The
// project and its phases come from the session, never from the form; the database stamps «تمّ» and audits every change.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { todayInTripoli } from '@/shared-kernel';
import { getMyProject } from '@/modules/projects';
import { createServerSupabase } from '@/platform/supabase/server';
import { addPour, markReminder, removePour } from '../application/concrete';
import type { PourField } from '../domain/concrete';
import { supabasePourStore } from '../infra/supabase-pour-store';
import { pourErrorsAr, pourFailedAr } from './messages.ar';
import { concretePath, pourPath } from './routes';

const FIELDS = ['element', 'pouredOn', 'supplier', 'qtyM3', 'cubeSamples', 'mixRef', 'deliveryRef', 'phaseId', 'curingUntil', 'formworkOn', 'note', 'clientOpId'] as const;

export interface PourFormState {
  fieldErrors?: Partial<Record<PourField, string>>;
  formError?: string;
  values?: Partial<Record<(typeof FIELDS)[number], string>>;
}

export async function addPourAction(_prev: PourFormState, form: FormData): Promise<PourFormState> {
  const values = Object.fromEntries(FIELDS.map((k) => [k, String(form.get(k) ?? '')])) as Record<(typeof FIELDS)[number], string>;
  const project = await getMyProject();
  if (!project) return { formError: pourFailedAr.no_project, values };
  const result = await addPour(supabasePourStore(await createServerSupabase()), project.id, project.phases.map((p) => p.id), values, todayInTripoli());
  if (!result.ok) {
    if (result.kind === 'failed') return { formError: pourFailedAr[result.reason], values };
    const fieldErrors: PourFormState['fieldErrors'] = {};
    for (const e of result.errors) fieldErrors[e.field] ??= pourErrorsAr[e.code];
    // The request id is not typed: if it is missing the owner can only try again.
    return { fieldErrors, formError: fieldErrors.clientOpId ? pourFailedAr.rejected : undefined, values };
  }
  revalidatePath('/', 'layout');
  redirect(`${pourPath(result.id)}?done=added`);
}

/** Bound to one pour, one reminder and done / undone. */
export async function markReminderAction(id: string, kind: string, done: boolean): Promise<void> {
  const project = await getMyProject();
  if (!project) redirect(pourPath(id));
  const r = await markReminder(supabasePourStore(await createServerSupabase()), project.id, id, kind, done);
  revalidatePath('/', 'layout');
  redirect(r.status === 'done' ? `${pourPath(id)}?done=changed` : pourPath(id));
}

/** Bound to one pour. Goes back to the log of its phase (or the project's). */
export async function deletePourAction(id: string, phaseId: string | null): Promise<void> {
  const project = await getMyProject();
  if (!project) redirect(concretePath(phaseId));
  const r = await removePour(supabasePourStore(await createServerSupabase()), project.id, id);
  revalidatePath('/', 'layout');
  const back = concretePath(phaseId);
  redirect(r.status === 'done' ? `${back}${back.includes('?') ? '&' : '?'}done=deleted` : pourPath(id));
}
