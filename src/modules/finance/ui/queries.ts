// Reads for Server Components (pages). Server-only: uses the signed-in user's session cookie (RLS applies).

import { createServerSupabase } from '@/platform/supabase/server';
import { expensesTotalLyd } from '../infra/expenses-total';

export async function getExpensesTotalLyd(projectId: string): Promise<string> {
  return expensesTotalLyd(await createServerSupabase(), projectId);
}
