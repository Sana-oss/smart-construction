import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExpenseReportStore } from '../application/expense-report';
import { EXPENSE_TYPES, type ExpenseType } from '../domain/expense';
import { supabaseBudgetStore } from './supabase-budget-store';

// Supabase adapter for the expenses report (FR-FIN-05). Always used with the signed-in user's client, so RLS decides
// what is visible (a stranger gets no rows). Reads only the finance module's own tables: expenses and budget_categories.

const isExpenseType = (v: unknown): v is ExpenseType => (EXPENSE_TYPES as readonly unknown[]).includes(v);

export function supabaseReportStore(supabase: SupabaseClient): ExpenseReportStore {
  return {
    async expensesIn(projectId, range) {
      // Amounts arrive as text, never as JS numbers (data rules).
      let query = supabase
        .from('expenses')
        .select('phase_id, expense_type, amount_lyd::text', { count: 'exact' })
        .eq('project_id', projectId);
      if (range) query = query.gte('paid_on', range.from).lt('paid_on', range.to);
      const { data, error, count } = await query.returns<{ phase_id: string | null; expense_type: string | null; amount_lyd: string }[]>();
      if (error) throw new Error(`expenses unavailable: ${error.message}`);
      const rows = data ?? [];
      // Supabase caps a response at 1,000 rows. Fewer rows than the count = a wrong total: refuse it (FR-FIN-05).
      if (count !== null && rows.length < count) throw new Error(`expenses incomplete: got ${rows.length} of ${count}`);
      return rows.map((r) => ({
        phaseId: r.phase_id,
        expenseType: isExpenseType(r.expense_type) ? r.expense_type : null,
        amountLyd: r.amount_lyd,
      }));
    },

    allocations: (projectId) => supabaseBudgetStore(supabase).allocations(projectId),
  };
}
