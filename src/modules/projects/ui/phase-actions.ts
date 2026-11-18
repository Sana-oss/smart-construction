'use server';

// Server Action: save one phase's status and dates (FR-PRJ-03). Runs as the signed-in user (RLS decides who may
// write); the form's values are checked again by the domain rules, never trusted as they are.

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { isUuid, todayInTripoli } from '@/shared-kernel';
import { createServerSupabase } from '@/platform/supabase/server';
import type { PhaseScheduleField } from '../domain/phase-schedule';
import { updatePhaseSchedule } from '../application/update-phase-schedule';
import { supabaseProjectGateway } from '../infra/supabase-project-gateway';
import { phaseScheduleErrorsAr, phaseUpdateFailedAr } from './messages.ar';
import { PHASES_PATH } from './routes';

export interface PhaseFormState {
  formError?: string;
  fieldErrors?: Partial<Record<PhaseScheduleField, string>>;
  /** What the owner chose, sent back after an error (React resets the form after each submission). */
  values?: Partial<Record<PhaseScheduleField, string>>;
}

const FIELDS: PhaseScheduleField[] = ['status', 'plannedStart', 'plannedEnd', 'actualStart', 'actualEnd'];

/** Bound to the phase id by the page: `updatePhaseScheduleAction.bind(null, phaseId)`. */
export async function updatePhaseScheduleAction(phaseId: string, _prev: PhaseFormState, form: FormData): Promise<PhaseFormState> {
  const values: Partial<Record<PhaseScheduleField, string>> = {};
  for (const f of FIELDS) {
    const v = form.get(f);
    if (typeof v === 'string') values[f] = v;
  }
  if (!isUuid(phaseId)) return { formError: phaseUpdateFailedAr.not_allowed, values };

  const gateway = supabaseProjectGateway(await createServerSupabase());
  const result = await updatePhaseSchedule(gateway, phaseId, values, todayInTripoli());
  if (!result.ok) {
    if (result.kind === 'failed') return { formError: phaseUpdateFailedAr[result.reason], values };
    const fieldErrors: PhaseFormState['fieldErrors'] = {};
    for (const e of result.errors) fieldErrors[e.field] ??= phaseScheduleErrorsAr[e.code];
    return { fieldErrors, values };
  }

  revalidatePath('/', 'layout');
  redirect(PHASES_PATH);
}
