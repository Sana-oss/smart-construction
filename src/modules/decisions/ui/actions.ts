'use server';

// Server Actions for the comparison's figures and the review (S18.2). Run on the server as the signed-in user, under RLS.
// The project and its phases come from the session (projects module), never from the form.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getMyProject } from '@/modules/projects';
import { createServerSupabase } from '@/platform/supabase/server';
import { saveComparisonInputs, saveReview } from '../application/comparison';
import { REVIEW_STEPS } from '../domain/review';
import type { ComparisonField } from '../domain/scenarios';
import { supabaseComparisonStore } from '../infra/supabase-comparison-store';
import { comparisonErrorsAr, decisionFailedAr } from './messages.ar';
import { DECISION_PATH } from './routes';

const FIELDS = ['remainingWorks', 'materialsOnHand', 'phaseId', 'phaseCost', 'protection', 'storage', 'restart', 'priceChangePct'] as const;

export interface ComparisonFormState {
  fieldErrors?: Partial<Record<ComparisonField, string>>;
  formError?: string;
  values?: Partial<Record<(typeof FIELDS)[number], string>>;
}

export async function saveComparisonAction(_prev: ComparisonFormState, form: FormData): Promise<ComparisonFormState> {
  const values = Object.fromEntries(FIELDS.map((k) => [k, String(form.get(k) ?? '')])) as Record<(typeof FIELDS)[number], string>;
  const project = await getMyProject();
  if (!project) return { formError: decisionFailedAr.no_project, values };

  const result = await saveComparisonInputs(
    supabaseComparisonStore(await createServerSupabase()),
    { ...values, projectId: project.id },
    project.phases.map((p) => p.id),
  );
  if (!result.ok) {
    if (result.kind === 'failed') return { formError: decisionFailedAr[result.reason], values };
    const fieldErrors: ComparisonFormState['fieldErrors'] = {};
    for (const e of result.errors) fieldErrors[e.field] ??= comparisonErrorsAr[e.code];
    return { fieldErrors, values };
  }
  revalidatePath(DECISION_PATH, 'layout');
  redirect(`${DECISION_PATH}?done=saved`);
}

export interface ReviewFormState {
  fieldErrors?: { note?: string; choice?: string };
  formError?: string;
}

export async function saveReviewAction(_prev: ReviewFormState, form: FormData): Promise<ReviewFormState> {
  const project = await getMyProject();
  if (!project) return { formError: decisionFailedAr.no_project };
  const steps = form.getAll('steps').map(String).filter((s) => REVIEW_STEPS.some((r) => r.key === s));
  const result = await saveReview(supabaseComparisonStore(await createServerSupabase()), {
    projectId: project.id,
    note: String(form.get('note') ?? ''),
    choice: String(form.get('choice') ?? ''),
    steps,
  });
  if (!result.ok) {
    if (result.kind === 'failed') return { formError: decisionFailedAr[result.reason] };
    const fieldErrors: ReviewFormState['fieldErrors'] = {};
    for (const e of result.errors) fieldErrors[e.field] ??= comparisonErrorsAr[e.code];
    return { fieldErrors };
  }
  revalidatePath(DECISION_PATH, 'layout');
  redirect(`${DECISION_PATH}?done=reviewed`);
}
