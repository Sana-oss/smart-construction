// Reads for Server Components (pages). Server-only: uses the signed-in user's session cookie (RLS applies).

import { createServerSupabase } from '@/platform/supabase/server';
import { listExpenses, type ExpenseList } from '../application/list-expenses';
import { supabaseExpenseReader } from '../infra/supabase-expense-reader';

/** The expenses list of a project (design S13.1). `today` is the date in Libya ("YYYY-MM-DD"). */
export async function getExpenseList(projectId: string, today: string): Promise<ExpenseList> {
  return listExpenses(supabaseExpenseReader(await createServerSupabase()), projectId, today);
}
