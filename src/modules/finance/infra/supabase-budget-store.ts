import type { SupabaseClient } from '@supabase/supabase-js';
import type { BudgetStore } from '../application/budget-plan';
import { mapExpenseError } from './supabase-expense-gateway';

// Supabase adapter for the budget plan (S15). Always used with the signed-in user's client, so RLS decides (0001: members
// read, writers write). Reads and writes only the finance module's own tables: budget_categories and expenses.

export function supabaseBudgetStore(supabase: SupabaseClient): BudgetStore {
  return {
    async allocations(projectId) {
      const { data, error } = await supabase
        .from('budget_categories')
        .select('phase_id, planned_lyd::text')
        .eq('project_id', projectId)
        .not('phase_id', 'is', null)
        .returns<{ phase_id: string; planned_lyd: string }[]>();
      if (error) throw new Error(`allocations unavailable: ${error.message}`);
      return new Map((data ?? []).map((r) => [r.phase_id, r.planned_lyd]));
    },

    async expensesByPhase(projectId) {
      // Amounts arrive as text, never as JS numbers (data rules).
      const { data, error, count } = await supabase
        .from('expenses')
        .select('phase_id, amount_lyd::text', { count: 'exact' })
        .eq('project_id', projectId)
        .returns<{ phase_id: string | null; amount_lyd: string }[]>();
      if (error) throw new Error(`expenses unavailable: ${error.message}`);
      const rows = data ?? [];
      // Supabase caps a response at 1,000 rows: fewer rows than the count would give a wrong per-phase total.
      if (count !== null && rows.length < count) throw new Error(`expenses incomplete: got ${rows.length} of ${count}`);
      return rows.map((r) => ({ phaseId: r.phase_id, amountLyd: r.amount_lyd }));
    },

    async saveAllocations(projectId, entries) {
      const set = entries.filter((e) => e.amountLyd !== null);
      const cleared = entries.filter((e) => e.amountLyd === null).map((e) => e.phaseId);
      if (set.length > 0) {
        // One allocation per phase (0021): an existing one is updated, a new one created. The database audits changes.
        const { error } = await supabase.from('budget_categories').upsert(
          set.map((e) => ({ project_id: projectId, phase_id: e.phaseId, planned_lyd: e.amountLyd })),
          { onConflict: 'project_id,phase_id' },
        );
        if (error) return { status: 'failed', reason: mapExpenseError(error) };
      }
      if (cleared.length > 0) {
        const { error } = await supabase.from('budget_categories').delete().eq('project_id', projectId).in('phase_id', cleared);
        if (error) return { status: 'failed', reason: mapExpenseError(error) };
      }
      return { status: 'done' };
    },
  };
}
