// Initial phases of a new project (FR-PRJ-01 step 2, FR-PRJ-03; decision 5 of 14 Nov 2026).
// The template rows come from the database table phase_templates (reference data, status 'unreviewed' until an
// engineer approves it). This file only turns "template + chosen current phase" into the phases to create.

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
 * Phases before the current one are 'done' (their dates are unknown, so none are set), the current one is
 * 'in_progress', the rest 'not_started'. Output is sorted by position.
 */
export function planInitialPhases(template: PhaseTemplateRow[], currentPosition: number | null | undefined): PhasePlanResult {
  if (template.length === 0) return { ok: false, error: 'template_empty' };
  if (currentPosition === null || currentPosition === undefined || Number.isNaN(currentPosition)) {
    return { ok: false, error: 'current_phase_required' };
  }
  const sorted = [...template].sort((a, b) => a.position - b.position);
  if (!sorted.some((p) => p.position === currentPosition)) return { ok: false, error: 'current_phase_unknown' };

  return {
    ok: true,
    value: sorted.map((p) => ({
      position: p.position,
      name: p.name,
      status: p.position < currentPosition ? 'done' : p.position === currentPosition ? 'in_progress' : 'not_started',
    })),
  };
}
