import { validatePhaseSchedule, type PhaseScheduleError, type PhaseScheduleInput } from '../domain/phase-schedule';
import type { PhaseUpdateFailure, ProjectGateway } from './project-gateway';

// Use case: the owner changes a phase's status and dates (FR-PRJ-03, from the phases screen S09.1).
// Runs on the SERVER: the values come from a form and are checked again here; the database checks a third time.

export type UpdatePhaseScheduleResult =
  | { ok: true }
  | { ok: false; kind: 'invalid'; errors: PhaseScheduleError[] }
  | { ok: false; kind: 'failed'; reason: PhaseUpdateFailure };

/**
 * @param today the date in Libya, "YYYY-MM-DD" (actual dates may not be after it).
 * @param startGaps FR-PRJ-05: the readiness gaps the owner saw and confirmed when starting this phase. Projects does not
 *   know the readiness list (it belongs to quality): the app finds the gaps and passes what was confirmed.
 * @param closeOpenIssues FR-QLT-07: the open defects the owner saw and confirmed when finishing this phase (same idea).
 */
export async function updatePhaseSchedule(
  gateway: ProjectGateway,
  phaseId: string,
  input: PhaseScheduleInput,
  today: string,
  startGaps: string[] | null = null,
  closeOpenIssues: string[] | null = null,
): Promise<UpdatePhaseScheduleResult> {
  const checked = validatePhaseSchedule(input, today);
  if (!checked.ok) return { ok: false, kind: 'invalid', errors: checked.errors };
  const outcome = await gateway.updatePhaseSchedule(phaseId, checked.value, startGaps, closeOpenIssues);
  return outcome.status === 'updated' ? { ok: true } : { ok: false, kind: 'failed', reason: outcome.reason };
}
