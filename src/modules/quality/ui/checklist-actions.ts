'use server';

// Server Actions for the pre-pour checkpoints (FR-QLT-01, FR-QLT-02). Run on the server as the signed-in user, under
// RLS. The project and its phases come from the session, never from the form; the use cases check every value; the
// database copies the template, stamps and audits each check, and completes the checklist (0025).

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getMyProject } from '@/modules/projects';
import { createServerSupabase } from '@/platform/supabase/server';
import { supabaseFileStore } from '@/platform/supabase/storage';
import { createChecklist, ensureReadiness, ensureStopPlan, recordCheck } from '../application/checklists';
import { checkPhotoStoragePath, type CheckField, type NewChecklistField } from '../domain/checklist';
import { supabaseChecklistStore } from '../infra/supabase-checklist-store';
import { checklistErrorsAr, checklistFailedAr } from './messages.ar';
import { checklistPath, READINESS_PATH, stopPlanPath } from './routes';

export interface NewChecklistState {
  fieldErrors?: Partial<Record<NewChecklistField, string>>;
  formError?: string;
  values?: { title?: string; templateId?: string };
}

/** Bound to the phase the page was opened for. */
export async function createChecklistAction(phaseId: string, _prev: NewChecklistState, form: FormData): Promise<NewChecklistState> {
  const values = { title: String(form.get('title') ?? ''), templateId: String(form.get('templateId') ?? '') };
  const project = await getMyProject();
  if (!project) return { formError: checklistFailedAr.no_project, values };
  const result = await createChecklist(
    supabaseChecklistStore(await createServerSupabase()),
    project.id,
    project.phases.map((p) => p.id),
    { ...values, phaseId },
  );
  if (!result.ok) {
    if (result.kind === 'failed') return { formError: checklistFailedAr[result.reason], values };
    const fieldErrors: NewChecklistState['fieldErrors'] = {};
    for (const e of result.errors) fieldErrors[e.field] ??= checklistErrorsAr[e.code];
    // The phase is not typed: a wrong one means the page was opened with a bad address.
    return { fieldErrors, formError: fieldErrors.phaseId ? checklistFailedAr.unknown_reference : undefined, values };
  }
  revalidatePath('/', 'layout');
  redirect(`${checklistPath(result.id)}?done=created`);
}

export interface CheckState {
  fieldErrors?: Partial<Record<CheckField, string>>;
  formError?: string;
  values?: Partial<Record<CheckField, string>>;
}

const CHECK_FIELDS = ['result', 'note', 'responsible', 'recheckOn', 'cost'] as const;

/** Bound to one item of one checklist. */
export async function recordCheckAction(checklistId: string, itemId: string, _prev: CheckState, form: FormData): Promise<CheckState> {
  const values = Object.fromEntries(CHECK_FIELDS.map((k) => [k, String(form.get(k) ?? '')])) as Record<CheckField, string>;
  const project = await getMyProject();
  if (!project) return { formError: checklistFailedAr.no_project, values };
  const supabase = await createServerSupabase();
  const photoPath = String(form.get('photoPath') ?? '');
  const result = await recordCheck(supabaseChecklistStore(supabase), project.id, checklistId, itemId, { ...values, photoPath }, supabaseFileStore(supabase));
  if (!result.ok) {
    if (result.kind === 'failed') return { formError: checklistFailedAr[result.reason], values };
    const fieldErrors: CheckState['fieldErrors'] = {};
    for (const e of result.errors) fieldErrors[e.field] ??= checklistErrorsAr[e.code];
    return { fieldErrors, values };
  }
  revalidatePath('/', 'layout');
  if (result.kind === 'readiness') redirect(`${READINESS_PATH}?done=saved`);
  if (result.kind === 'safe_stop' && result.phaseId) redirect(`${stopPlanPath(result.phaseId)}&done=saved`);
  redirect(`${checklistPath(checklistId)}?done=saved`);
}

export type CheckPhotoTicket = { ok: true; path: string; token: string } | { ok: false; message: string };

/**
 * Item photo, step 1 (slice 2): a fresh path in the project's checklists folder and a one-time upload token. The storage
 * policies of 0013 refuse the token to anyone who may not write to the project. The browser then uploads, and
 * recordCheckAction checks the file and stores it with the check.
 */
export async function prepareCheckPhotoUploadAction(): Promise<CheckPhotoTicket> {
  const project = await getMyProject();
  if (!project) return { ok: false, message: checklistFailedAr.no_project };
  const path = checkPhotoStoragePath(project.id, crypto.randomUUID());
  const ticket = await supabaseFileStore(await createServerSupabase()).uploadTicket(path);
  return ticket ? { ok: true, path, token: ticket.token } : { ok: false, message: checklistFailedAr.not_allowed };
}

/** FR-PRJ-05: the project's readiness list, from its template (the same list when it exists). */
export async function createReadinessAction(): Promise<void> {
  const project = await getMyProject();
  if (!project) redirect(READINESS_PATH);
  await ensureReadiness(supabaseChecklistStore(await createServerSupabase()), project.id);
  revalidatePath('/', 'layout');
  redirect(READINESS_PATH);
}

/** 3.14 (FR-DEC-04): the phase's stop plan, from its template (the same plan when it exists). Bound to the phase. */
export async function createStopPlanAction(phaseId: string): Promise<void> {
  const project = await getMyProject();
  if (!project) redirect(stopPlanPath(phaseId));
  await ensureStopPlan(supabaseChecklistStore(await createServerSupabase()), project.id, project.phases.map((p) => p.id), phaseId);
  revalidatePath('/', 'layout');
  redirect(stopPlanPath(phaseId));
}
