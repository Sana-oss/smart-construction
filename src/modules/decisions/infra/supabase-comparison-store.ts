import type { SupabaseClient } from '@supabase/supabase-js';
import { money } from '@/shared-kernel';
import type { ComparisonStore, DecisionFailure, StoredComparison } from '../application/comparison';
import { SCENARIOS, type Scenario } from '../domain/scenarios';

// Supabase adapter for the comparison (S18). Always used with the signed-in user's client, so RLS decides (0001:
// members read, writers write). Reads only the decisions module's own table, decision_scenarios (one row per project).

export function mapDecisionError(error: { code?: string }): DecisionFailure {
  switch (error.code) {
    case '42501':
      return 'not_allowed';
    case '23503': // the phase does not belong to this project (0019 guard)
      return 'unknown_reference';
    case '23514':
    case '22003':
      return 'rejected';
    default:
      return 'unavailable';
  }
}

interface Row {
  remaining_works_lyd: string | null;
  materials_on_hand_lyd: string | null;
  phase_id: string | null;
  phase_cost_lyd: string | null;
  protection_lyd: string | null;
  storage_lyd: string | null;
  restart_lyd: string | null;
  price_change_pct: string;
  review_note: string | null;
  choice: string | null;
  funding_confirmed: boolean;
  contracts_reviewed: boolean;
  site_assessed: boolean;
  plan_decided: boolean;
}

export function toStored(r: Row): StoredComparison {
  return {
    inputs: {
      remainingWorks: r.remaining_works_lyd,
      materialsOnHand: r.materials_on_hand_lyd,
      phaseId: r.phase_id,
      phaseCost: r.phase_cost_lyd,
      protection: r.protection_lyd,
      storage: r.storage_lyd,
      restart: r.restart_lyd,
      // numeric(5,2) arrives as "10.00": the plain form ("10", "-5", "12.5") is what the owner typed and reads.
      priceChangePct: money(r.price_change_pct).toString(),
    },
    review: {
      note: r.review_note,
      choice: (SCENARIOS as readonly string[]).includes(r.choice ?? '') ? (r.choice as Scenario) : null,
      steps: {
        fundingConfirmed: r.funding_confirmed,
        contractsReviewed: r.contracts_reviewed,
        siteAssessed: r.site_assessed,
        planDecided: r.plan_decided,
      },
    },
  };
}

export function supabaseComparisonStore(supabase: SupabaseClient): ComparisonStore {
  return {
    async load(projectId) {
      // Money and the percentage arrive as text ("::text"), never as JS numbers (data rules).
      const { data, error } = await supabase
        .from('decision_scenarios')
        .select(
          'remaining_works_lyd::text, materials_on_hand_lyd::text, phase_id, phase_cost_lyd::text, protection_lyd::text, storage_lyd::text, restart_lyd::text, price_change_pct::text, review_note, choice, funding_confirmed, contracts_reviewed, site_assessed, plan_decided',
        )
        .eq('project_id', projectId)
        .returns<Row[]>()
        .maybeSingle();
      if (error) throw new Error(`comparison unavailable: ${error.message}`);
      return data ? toStored(data as Row) : null;
    },

    async saveInputs(projectId, i) {
      const { error } = await supabase.from('decision_scenarios').upsert(
        {
          project_id: projectId,
          remaining_works_lyd: i.remainingWorks,
          materials_on_hand_lyd: i.materialsOnHand,
          phase_id: i.phaseId,
          phase_cost_lyd: i.phaseCost,
          protection_lyd: i.protection,
          storage_lyd: i.storage,
          restart_lyd: i.restart,
          price_change_pct: i.priceChangePct,
        },
        { onConflict: 'project_id' },
      );
      return error ? { status: 'failed', reason: mapDecisionError(error) } : { status: 'done' };
    },

    async saveReview(projectId, r) {
      const { error } = await supabase.from('decision_scenarios').upsert(
        {
          project_id: projectId,
          review_note: r.note,
          choice: r.choice,
          funding_confirmed: r.steps.fundingConfirmed,
          contracts_reviewed: r.steps.contractsReviewed,
          site_assessed: r.steps.siteAssessed,
          plan_decided: r.steps.planDecided,
        },
        { onConflict: 'project_id' },
      );
      return error ? { status: 'failed', reason: mapDecisionError(error) } : { status: 'done' };
    },
  };
}
