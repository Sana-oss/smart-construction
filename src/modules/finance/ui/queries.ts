// Reads for Server Components (pages). Server-only: uses the signed-in user's session cookie (RLS applies).

import { createServerSupabase } from '@/platform/supabase/server';
import { supabaseFileStore } from '@/platform/supabase/storage';
import { findExpense, listExpenses, type ExpenseList, type ExpenseListItem } from '../application/list-expenses';
import { supabaseExpenseReader } from '../infra/supabase-expense-reader';

/** The expenses list of a project (design S13.1). `today` is the date in Libya ("YYYY-MM-DD"). */
export async function getExpenseList(projectId: string, today: string): Promise<ExpenseList> {
  const supabase = await createServerSupabase();
  return listExpenses(supabaseExpenseReader(supabase), projectId, today, supabaseFileStore(supabase));
}

/** One expense of the project, for its edit screen; null when not found (or not visible to this user). */
export async function getExpense(projectId: string, expenseId: string): Promise<ExpenseListItem | null> {
  const supabase = await createServerSupabase();
  return findExpense(supabaseExpenseReader(supabase), projectId, expenseId, supabaseFileStore(supabase));
}
