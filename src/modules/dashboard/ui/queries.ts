// Reads for Server Components (pages). Server-only: uses the signed-in user's session cookie (RLS applies).

import { createServerSupabase } from '@/platform/supabase/server';
import { recordedExpensesLyd } from '../infra/recorded-expenses';

export async function getRecordedExpensesLyd(projectId: string): Promise<string> {
  return recordedExpensesLyd(await createServerSupabase(), projectId);
}
