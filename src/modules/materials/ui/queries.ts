// Reads for Server Components (pages). Server-only: uses the signed-in user's session cookie (RLS applies).

import { createServerSupabase } from '@/platform/supabase/server';
import { getPriceHistory, getPriceLog, type PriceLog, type PriceWithStatus } from '../application/prices';
import { supabasePriceStore } from '../infra/supabase-price-store';

/** The price log (design S24.1). `today` is the date in Libya. */
export async function getProjectPriceLog(projectId: string, today: string): Promise<PriceLog> {
  return getPriceLog(supabasePriceStore(await createServerSupabase()), projectId, today);
}

/** One material's history (design S24.2). */
export async function getProjectPriceHistory(projectId: string, material: string, unit: string, today: string): Promise<PriceWithStatus[]> {
  return getPriceHistory(supabasePriceStore(await createServerSupabase()), projectId, material, unit, today);
}
