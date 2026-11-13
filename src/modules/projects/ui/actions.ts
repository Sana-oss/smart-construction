'use server';

// Server Action for the wizard's last step: create the first project (FR-PRJ-01). Runs as the signed-in owner
// (RLS); the browser's answers are re-validated here by the same domain rules, never trusted as they are.

import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@/platform/supabase/server';
import { createFirstProject, type WizardDraft } from '../application/create-first-project';
import { supabaseProjectGateway } from '../infra/supabase-project-gateway';
import { toFieldErrors } from './field-errors';
import { createFailedAr, wizardTextAr, type SetupFieldErrors } from './messages.ar';

export type CreateProjectState =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: SetupFieldErrors; needsConfirmation?: boolean; alreadyHasProject?: boolean };

const TEXT_FIELDS = [
  'name',
  'city',
  'otherCity',
  'projectType',
  'buildingArea',
  'totalBudget',
  'availableNow',
  'spentBefore',
  'contingencyPct',
] as const;

/** Keep only the known fields, as strings: whatever else the browser sends is dropped. */
function sanitize(raw: unknown): WizardDraft {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const draft: WizardDraft = {};
  for (const k of TEXT_FIELDS) if (typeof src[k] === 'string') draft[k] = src[k] as string;
  if (typeof src.currentPhase === 'number' && Number.isInteger(src.currentPhase)) draft.currentPhase = src.currentPhase;
  draft.overBudgetConfirmed = src.overBudgetConfirmed === true;
  return draft;
}

export async function createFirstProjectAction(raw: unknown): Promise<CreateProjectState> {
  const gateway = supabaseProjectGateway(await createServerSupabase());
  const result = await createFirstProject(gateway, sanitize(raw));

  if (result.ok) {
    revalidatePath('/', 'layout');
    return { ok: true };
  }
  switch (result.kind) {
    case 'invalid':
      return { ok: false, message: wizardTextAr.review.incomplete, fieldErrors: toFieldErrors(result.errors) };
    case 'needs_confirmation':
      return { ok: false, message: wizardTextAr.review.overBudgetNeeded, needsConfirmation: true };
    case 'failed':
      return {
        ok: false,
        message: createFailedAr[result.reason],
        alreadyHasProject: result.reason === 'already_has_project',
      };
  }
}
