// Server-only: save one phase's status and dates for an action that lives in the app (the readiness gate of 3.15, which
// needs the quality module that projects may not import). Not a 'use server' file: never called from the browser.

import { isUuid, todayInTripoli } from '@/shared-kernel';
import { createServerSupabase } from '@/platform/supabase/server';
import { updatePhaseSchedule } from '../application/update-phase-schedule';
import type { PhaseScheduleField } from '../domain/phase-schedule';
import { supabaseProjectGateway } from '../infra/supabase-project-gateway';
import { phaseScheduleErrorsAr, phaseUpdateFailedAr } from './messages.ar';
import type { PhaseFormState } from './phase-actions';

export const PHASE_FORM_FIELDS: PhaseScheduleField[] = ['status', 'plannedStart', 'plannedEnd', 'actualStart', 'actualEnd'];

/** The form's values, as the owner sent them. */
export function readPhaseForm(form: FormData): Partial<Record<PhaseScheduleField, string>> {
  const values: Partial<Record<PhaseScheduleField, string>> = {};
  for (const f of PHASE_FORM_FIELDS) {
    const v = form.get(f);
    if (typeof v === 'string') values[f] = v;
  }
  return values;
}

/** Saves the phase. null = saved; otherwise the state to show (errors, with the values sent back). */
export async function savePhaseSchedule(
  phaseId: string,
  values: Partial<Record<PhaseScheduleField, string>>,
  startGaps: string[] | null,
): Promise<PhaseFormState | null> {
  if (!isUuid(phaseId)) return { formError: phaseUpdateFailedAr.not_allowed, values };
  const result = await updatePhaseSchedule(supabaseProjectGateway(await createServerSupabase()), phaseId, values, todayInTripoli(), startGaps);
  if (result.ok) return null;
  if (result.kind === 'failed') return { formError: phaseUpdateFailedAr[result.reason], values };
  const fieldErrors: PhaseFormState['fieldErrors'] = {};
  for (const e of result.errors) fieldErrors[e.field] ??= phaseScheduleErrorsAr[e.code];
  return { fieldErrors, values };
}
