'use server';

// The readiness gate (3.15; FR-PRJ-05; owner's decision of 20 Nov 2026). In the app layer because it uses two modules:
// projects (the phase) and quality (the readiness list), and projects may not import quality (rule R2).
// Starting a phase («لم تبدأ» -> «قيد التنفيذ») while the readiness list has gaps is allowed (decision D2: never block),
// but the form shows the gaps first and asks; the confirmation and the gaps go to the audit log in the same transaction
// as the start (0027). Any other change of the phase saves as before.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  getMyProject,
  isPhaseClose,
  isPhaseStart,
  phasePath,
  readPhaseForm,
  savePhaseSchedule,
  type PhaseFormState,
  type PhaseStatus,
} from '@/modules/projects';
import { getOpenIssuesOfPhaseAr, getReadinessGapsAr } from '@/modules/quality';

const STATUSES: PhaseStatus[] = ['not_started', 'in_progress', 'closing', 'done', 'blocked'];

export async function savePhaseWithGateAction(phaseId: string, _prev: PhaseFormState, form: FormData): Promise<PhaseFormState> {
  const values = readPhaseForm(form);
  const project = await getMyProject();
  const phase = project?.phases.find((p) => p.id === phaseId);
  let startGaps: string[] | null = null;
  if (project && phase && STATUSES.includes(values.status as PhaseStatus) && isPhaseStart(phase.status, values.status as PhaseStatus)) {
    const gaps = await getReadinessGapsAr(project.id);
    if (gaps.length > 0) {
      if (form.get('startConfirmed') !== 'yes') return { startGaps: gaps, values };
      startGaps = gaps;
    }
  }
  // FR-QLT-07 (3.17): finishing a phase with open defects asks first, the same way (D2).
  let closeOpenIssues: string[] | null = null;
  if (project && phase && STATUSES.includes(values.status as PhaseStatus) && isPhaseClose(phase.status, values.status as PhaseStatus)) {
    const open = await getOpenIssuesOfPhaseAr(project.id, phase.id);
    if (open.length > 0) {
      if (form.get('closeConfirmed') !== 'yes') return { closeOpenIssues: open, startGaps: startGaps ?? undefined, values };
      closeOpenIssues = open;
    }
  }
  const failed = await savePhaseSchedule(phaseId, values, startGaps, closeOpenIssues);
  if (failed) return failed;
  revalidatePath('/', 'layout');
  redirect(phasePath(phaseId));
}
