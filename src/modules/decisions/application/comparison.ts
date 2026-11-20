import { isUuid, money, toDb, type Money } from '@/shared-kernel';
import { cashflowOutlook, type CashflowOutlook, type Movement } from '@/modules/finance';
import type { PriceWarnings } from '@/modules/materials';
import { validateReview, type Review, type ReviewError, type ReviewInput } from '../domain/review';
import { scenarioCosts, validateComparison, type ComparisonError, type ComparisonInput, type ComparisonInputs, type ScenarioCost } from '../domain/scenarios';

// Use cases: the continue-or-pause comparison (design S18.1, S18.2; FR-DEC-01, 02, 03, 05; slice 3 of 3.7).
// Runs on the server as the signed-in user, under RLS. The comparison is computed fresh every time from the owner's
// figures (decisions), the cash (finance) and the price log (materials): nothing computed is stored, so nothing goes stale.

/** What is stored for a project (0019): the figures as decimal strings, and the review. */
export interface StoredComparison {
  inputs: {
    remainingWorks: string | null;
    materialsOnHand: string | null;
    phaseId: string | null;
    phaseCost: string | null;
    protection: string | null;
    storage: string | null;
    restart: string | null;
    priceChangePct: string;
  };
  review: Review;
}

export type DecisionFailure = 'not_allowed' | 'rejected' | 'unknown_reference' | 'unavailable';
export type DecisionOutcome = { status: 'done' } | { status: 'failed'; reason: DecisionFailure };

/** Port. The Supabase adapter is infra/supabase-comparison-store.ts; tests use a fake. */
export interface ComparisonStore {
  load(projectId: string): Promise<StoredComparison | null>;
  /** Creates the project's row or changes only the figures (the review stays). The database audits it (0019). */
  saveInputs(projectId: string, inputs: StoredComparison['inputs']): Promise<DecisionOutcome>;
  /** Creates the project's row or changes only the review (the figures stay). */
  saveReview(projectId: string, review: Review): Promise<DecisionOutcome>;
}

export type SaveInputsResult =
  | { ok: true }
  | { ok: false; kind: 'invalid'; errors: ComparisonError[] }
  | { ok: false; kind: 'failed'; reason: DecisionFailure };

const str = (m: Money | null) => (m === null ? null : toDb(m));

/** @param phaseIds the project's phases (from the projects module, through the page). */
export async function saveComparisonInputs(
  store: ComparisonStore,
  command: ComparisonInput & { projectId: string },
  phaseIds: readonly string[],
): Promise<SaveInputsResult> {
  if (!isUuid(command.projectId)) return { ok: false, kind: 'failed', reason: 'not_allowed' };
  const valid = validateComparison(command, phaseIds.map((p) => p.toLowerCase()));
  if (!valid.ok) return { ok: false, kind: 'invalid', errors: valid.errors };
  const v = valid.value;
  const outcome = await store.saveInputs(command.projectId.toLowerCase(), {
    remainingWorks: str(v.remainingWorks),
    materialsOnHand: str(v.materialsOnHand),
    phaseId: v.phaseId,
    phaseCost: str(v.phaseCost),
    protection: str(v.protection),
    storage: str(v.storage),
    restart: str(v.restart),
    priceChangePct: v.priceChangePct,
  });
  return outcome.status === 'done' ? { ok: true } : { ok: false, kind: 'failed', reason: outcome.reason };
}

export type SaveReviewResult = { ok: true } | { ok: false; kind: 'invalid'; errors: ReviewError[] } | { ok: false; kind: 'failed'; reason: DecisionFailure };

export async function saveReview(store: ComparisonStore, command: ReviewInput & { projectId: string }): Promise<SaveReviewResult> {
  if (!isUuid(command.projectId)) return { ok: false, kind: 'failed', reason: 'not_allowed' };
  const valid = validateReview(command);
  if (!valid.ok) return { ok: false, kind: 'invalid', errors: valid.errors };
  const outcome = await store.saveReview(command.projectId.toLowerCase(), valid.value);
  return outcome.status === 'done' ? { ok: true } : { ok: false, kind: 'failed', reason: outcome.reason };
}

export interface ScenarioView extends ScenarioCost {
  /** The 30-day outlook with this scenario's cost NOW paid today; null without liquidity or cost. */
  outlook: CashflowOutlook | null;
}

export interface ComparisonView {
  stored: StoredComparison | null;
  /** «السيولة الحالية» (finance), or null when unknown. */
  liquidity: Money | null;
  /** S18.1 summary: the 30-day outlook without any scenario. */
  base: CashflowOutlook | null;
  scenarios: ScenarioView[];
  /** FR-DEC-03: old prices and expired quotes in the log. */
  priceWarnings: PriceWarnings;
}

const emptyInputs = (): ComparisonInputs => ({
  remainingWorks: null,
  materialsOnHand: null,
  phaseId: null,
  phaseCost: null,
  protection: null,
  storage: null,
  restart: null,
  priceChangePct: '0',
});

/** Stored strings -> the domain's inputs (they were validated when saved, and the database checked them again). */
function toInputs(s: StoredComparison['inputs']): ComparisonInputs {
  const m = (v: string | null) => (v === null ? null : money(v));
  return {
    remainingWorks: m(s.remainingWorks),
    materialsOnHand: m(s.materialsOnHand),
    phaseId: s.phaseId,
    phaseCost: m(s.phaseCost),
    protection: m(s.protection),
    storage: m(s.storage),
    restart: m(s.restart),
    priceChangePct: s.priceChangePct,
  };
}

/**
 * S18.1. Everything is passed in, so this is easy to test: the stored figures, the cash from finance and the price
 * warnings from materials. @param today the date in Libya.
 */
export function buildComparison(
  stored: StoredComparison | null,
  cash: { liquidity: Money | null; movements: readonly Movement[] },
  priceWarnings: PriceWarnings,
  today: string,
): ComparisonView {
  const costs = scenarioCosts(stored ? toInputs(stored.inputs) : emptyInputs());
  const outlook = (now: Money | null) =>
    cash.liquidity === null || now === null
      ? null
      : cashflowOutlook(cash.liquidity, [...cash.movements, { kind: 'obligation', amountLyd: now, date: today }], today);
  return {
    stored,
    liquidity: cash.liquidity,
    base: cash.liquidity === null ? null : cashflowOutlook(cash.liquidity, cash.movements, today),
    scenarios: costs.map((c) => ({ ...c, outlook: outlook(c.costNow) })),
    priceWarnings,
  };
}
