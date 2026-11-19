// Reads for Server Components (pages). Server-only: uses the signed-in user's session cookie (RLS applies).

import { createServerSupabase } from '@/platform/supabase/server';
import { supabaseFileStore } from '@/platform/supabase/storage';
import { listExpenses, type ExpenseList } from '../application/list-expenses';
import { supabaseExpenseReader } from '../infra/supabase-expense-reader';

/** The expenses list of a project (design S13.1). `today` is the date in Libya ("YYYY-MM-DD"). */
export async function getExpenseList(projectId: string, today: string): Promise<ExpenseList> {
  const supabase = await createServerSupabase();
  return listExpenses(supabaseExpenseReader(supabase), projectId, today, supabaseFileStore(supabase));
}
