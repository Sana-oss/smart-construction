'use server';

// Server Actions for the defects list (FR-QLT-06). Run on the server as the signed-in user, under RLS. The project and its
// phases come from the session, never from the form; the use cases check every value; the database dates each state and
// audits every change (0029). A photo is uploaded by the browser with a one-time token, then checked here.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getMyProject } from '@/modules/projects';
import { createServerSupabase } from '@/platform/supabase/server';
import { supabaseFileStore } from '@/platform/supabase/storage';
import { addIssue, changeIssueStatus, issuePhotoStoragePath, replaceIssuePhoto } from '../application/issues';
import type { IssueField } from '../domain/issue';
import { supabaseIssueStore } from '../infra/supabase-issue-store';
import { issueErrorsAr, issueFailedAr } from './messages.ar';
import { issuePath } from './routes';

const FIELDS = ['title', 'location', 'description', 'responsible', 'severity', 'phaseId', 'dueOn', 'checklistId'] as const;

export interface IssueFormState {
  fieldErrors?: Partial<Record<IssueField, string>>;
  formError?: string;
  values?: Partial<Record<(typeof FIELDS)[number], string>>;
}

export async function addIssueAction(_prev: IssueFormState, form: FormData): Promise<IssueFormState> {
  const values = Object.fromEntries(FIELDS.map((k) => [k, String(form.get(k) ?? '')])) as Record<(typeof FIELDS)[number], string>;
  const project = await getMyProject();
  if (!project) return { formError: issueFailedAr.no_project, values };
  const supabase = await createServerSupabase();
  const result = await addIssue(
    supabaseIssueStore(supabase),
    project.id,
    project.phases.map((p) => p.id),
    { ...values, photoPath: String(form.get('photoPath') ?? '') },
    supabaseFileStore(supabase),
  );
  if (!result.ok) {
    if (result.kind === 'failed') return { formError: issueFailedAr[result.reason], values };
    const fieldErrors: IssueFormState['fieldErrors'] = {};
    for (const e of result.errors) fieldErrors[e.field] ??= issueErrorsAr[e.code];
    return { fieldErrors, values };
  }
  revalidatePath('/', 'layout');
  redirect(`${issuePath(result.id)}?done=added`);
}

/** Bound to one defect and one state. */
export async function setIssueStatusAction(id: string, status: string): Promise<void> {
  const project = await getMyProject();
  if (!project) redirect(issuePath(id));
  const r = await changeIssueStatus(supabaseIssueStore(await createServerSupabase()), project.id, id, status);
  revalidatePath('/', 'layout');
  redirect(r.status === 'done' ? `${issuePath(id)}?done=changed` : issuePath(id));
}

export type IssuePhotoTicket = { ok: true; path: string; token: string } | { ok: false; message: string };

/** A fresh path in the project's issues folder and a one-time upload token (storage policies of 0013 decide). */
export async function prepareIssuePhotoUploadAction(): Promise<IssuePhotoTicket> {
  const project = await getMyProject();
  if (!project) return { ok: false, message: issueFailedAr.no_project };
  const path = issuePhotoStoragePath(project.id, crypto.randomUUID());
  const ticket = await supabaseFileStore(await createServerSupabase()).uploadTicket(path);
  return ticket ? { ok: true, path, token: ticket.token } : { ok: false, message: issueFailedAr.not_allowed };
}

/** Bound to one defect: the photo the browser just uploaded replaces the old one. */
export async function replaceIssuePhotoAction(id: string, photoPath: string): Promise<{ ok: boolean; message?: string }> {
  const project = await getMyProject();
  if (!project) return { ok: false, message: issueFailedAr.no_project };
  const supabase = await createServerSupabase();
  const r = await replaceIssuePhoto(supabaseIssueStore(supabase), project.id, id, photoPath, supabaseFileStore(supabase));
  if (r.status === 'failed') return { ok: false, message: issueFailedAr[r.reason] };
  revalidatePath('/', 'layout');
  return { ok: true };
}
