import type { SupabaseClient } from '@supabase/supabase-js';
import { addMoney, toDb } from '@/shared-kernel';

/**
 * Sum of the project's recorded expenses in LYD, as a decimal string. Runs as the signed-in user (RLS).
 * The sum is done with Decimal, never with JS numbers (CLAUDE.md data rules).
 */
export async function expensesTotalLyd(supabase: SupabaseClient, projectId: string): Promise<string> {
  const { data, error } = await supabase.from('expenses').select('amount_lyd').eq('project_id', projectId);
  if (error) throw new Error(`expenses unavailable: ${error.message}`);
  return toDb(addMoney(...(data ?? []).map((r) => String(r.amount_lyd))));
}
