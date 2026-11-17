// Initial phases of a new project (FR-PRJ-01 step 2, FR-PRJ-03; decision 5 of 14 Nov 2026, changed 16 Nov).
// The template rows come from the database table phase_templates (reference data, status 'unreviewed' until an
// engineer approves it). This file only turns "template + the owner's answers" into the phases to create.
//
// Decision of 16 Nov 2026 (solution B, change register): a phase before the current one is NOT assumed finished.
// The owner chooses the current phase, and every earlier phase starts as finished; the owner can untick the ones
// that are not finished yet (work often overlaps: the structure starts before the foundations are signed off).

export type PhaseStatus = 'not_started' | 'in_progress' | 'closing' | 'done' | 'blocked';

export interface PhaseTemplateRow {
  position: number;
  name: string;
}

export interface PlannedPhase {
  position: number;
  name: string;
  status: PhaseStatus;
}

export type PhasePlanResult =
  | { ok: true; value: PlannedPhase[] }
  | { ok: false; error: 'template_empty' | 'current_phase_required' | 'current_phase_unknown' };

/**
 * @param currentPosition The phase the owner says the project is in now: 'in_progress'.
 * @param unfinishedEarlier Positions of EARLIER phases the owner marked as not finished: also 'in_progress'.
 *   Every other earlier phase is 'done' (its dates are unknown, so none are set), every later phase 'not_started'.
 *   Positions that are not before the current phase are ignored: they are left over when the owner changes the
 *   current phase after unticking, and they cannot mean anything.
 * Output is sorted by position.
 */
export function planInitialPhases(
  template: PhaseTemplateRow[],
  currentPosition: number | null | undefined,
  unfinishedEarlier: readonly number[] = [],
): PhasePlanResult {
  if (template.length === 0) return { ok: false, error: 'template_empty' };
  if (currentPosition === null || currentPosition === undefined || Number.isNaN(currentPosition)) {
    return { ok: false, error: 'current_phase_required' };
  }
  const sorted = [...template].sort((a, b) => a.position - b.position);
  if (!sorted.some((p) => p.position === currentPosition)) return { ok: false, error: 'current_phase_unknown' };

  const unfinished = new Set(unfinishedEarlier);
  const statusOf = (position: number): PhaseStatus => {
    if (position === currentPosition) return 'in_progress';
    if (position > currentPosition) return 'not_started';
    return unfinished.has(position) ? 'in_progress' : 'done';
  };
  return { ok: true, value: sorted.map((p) => ({ position: p.position, name: p.name, status: statusOf(p.position) })) };
}

/**
 * The phase the project is in NOW: the furthest phase that is in progress. Since solution B an earlier phase can
 * also be in progress (not finished yet), so "the first phase in progress" would point at the wrong one.
 * Works on any list of phases with a position and a status; null when no phase is in progress.
 */
export function currentPhaseOf<P extends { position: number; status: PhaseStatus }>(phases: readonly P[]): P | null {
  let current: P | null = null;
  for (const p of phases) if (p.status === 'in_progress' && (current === null || p.position > current.position)) current = p;
  return current;
}
