import { SCENARIOS, type Scenario } from './scenarios';

// Reviewing the scenario (design S18.2 «مراجعة السيناريو»). Engineer and contractor accounts are excluded, so the four
// steps of the design are a checklist the OWNER ticks, each saying who does it in real life (owner's decision of 19 Nov
// 2026). Ticking a step records what the owner says happened; the app does not certify it (no engineering approval).

export const REVIEW_STEPS = [
  { key: 'fundingConfirmed', who: 'owner' },
  { key: 'contractsReviewed', who: 'manager' },
  { key: 'siteAssessed', who: 'engineer' },
  { key: 'planDecided', who: 'joint' },
] as const;
export type ReviewStep = (typeof REVIEW_STEPS)[number]['key'];

export const REVIEW_NOTE_MAX = 500;

export interface ReviewInput {
  note?: string | null;
  /** The chosen way, or empty for «لم يُحدَّد بعد». */
  choice?: string | null;
  /** The ticked steps (checkbox values). */
  steps?: readonly string[];
}

export interface Review {
  note: string | null;
  choice: Scenario | null;
  steps: Record<ReviewStep, boolean>;
}

export type ReviewError = { field: 'note'; code: 'too_long' } | { field: 'choice'; code: 'unknown_choice' };
export type ReviewValidation = { ok: true; value: Review } | { ok: false; errors: ReviewError[] };

export function validateReview(input: ReviewInput): ReviewValidation {
  const errors: ReviewError[] = [];
  const note = (input.note ?? '').trim() || null;
  if (note !== null && [...note].length > REVIEW_NOTE_MAX) errors.push({ field: 'note', code: 'too_long' });
  const raw = (input.choice ?? '').trim();
  let choice: Scenario | null = null;
  if (raw !== '') {
    if ((SCENARIOS as readonly string[]).includes(raw)) choice = raw as Scenario;
    else errors.push({ field: 'choice', code: 'unknown_choice' });
  }
  const ticked = new Set(input.steps ?? []);
  const steps = Object.fromEntries(REVIEW_STEPS.map((s) => [s.key, ticked.has(s.key)])) as Record<ReviewStep, boolean>;
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: { note, choice, steps } };
}
