import type { SupabaseClient } from '@supabase/supabase-js';
import { money, toDb } from '@/shared-kernel';

/**
 * Total of the project's recorded expenses in LYD, as a decimal string. Runs as the signed-in user (RLS).
 *
 * The database adds the rows up (view budget_summary, column recorded_expenses_lyd, migration 0007) and we read
 * ONE row. Downloading every expense and adding them here would go wrong silently: Supabase returns at most
 * 1,000 rows per request. "::text" asks for the total as text, so the amount never passes through a JS number
 * (CLAUDE.md data rules). The view gives raw numbers only; spent, remaining and contingency are computed by the
 * finance domain (rule R5).
 */
export async function recordedExpensesLyd(supabase: SupabaseClient, projectId: string): Promise<string> {
  const { data, error } = await supabase
    .from('budget_summary')
    .select('recorded_expenses_lyd::text')
    .eq('project_id', projectId)
    .maybeSingle<{ recorded_expenses_lyd: string | null }>();
  if (error) throw new Error(`expenses total unavailable: ${error.message}`);
  // No row: the project is not visible to this user (RLS). No expenses yet: the view already gives 0.
  return toDb(money(data?.recorded_expenses_lyd ?? '0'));
}
