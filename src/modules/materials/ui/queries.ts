// Reads for Server Components (pages). Server-only: uses the signed-in user's session cookie (RLS applies).

import { createServerSupabase } from '@/platform/supabase/server';
import { getRebarCalculator, type RebarCalculatorView } from '../application/calculators';
import { getItemDetail, getQuantityTable, type ItemDetail, type QuantityTable } from '../application/quantities';
import { getPriceHistory, getPriceLog, type PriceLog, type PriceWithStatus } from '../application/prices';
import { priceWarnings, type PriceWarnings } from '../domain/price';
import type { RebarInput } from '../domain/calculators';
import { supabaseCoefficientReader } from '../infra/supabase-coefficient-reader';
import { supabasePriceStore } from '../infra/supabase-price-store';
import { supabaseQuantityStore } from '../infra/supabase-quantity-store';

/** The price log (design S24.1). `today` is the date in Libya. */
export async function getProjectPriceLog(projectId: string, today: string): Promise<PriceLog> {
  return getPriceLog(supabasePriceStore(await createServerSupabase()), projectId, today);
}

/** One material's history (design S24.2). */
export async function getProjectPriceHistory(projectId: string, material: string, unit: string, today: string): Promise<PriceWithStatus[]> {
  return getPriceHistory(supabasePriceStore(await createServerSupabase()), projectId, material, unit, today);
}

/** What the price log says should not be trusted as it is (for the 3.7 comparison, FR-DEC-03). */
export async function getProjectPriceWarnings(projectId: string, today: string): Promise<PriceWarnings> {
  return priceWarnings(await supabasePriceStore(await createServerSupabase()).list(projectId), today);
}

/** The rebar calculator (design S22): the stored coefficient, and the calculation when the form was sent. */
export async function getRebarCalculatorView(input: RebarInput | null): Promise<RebarCalculatorView> {
  return getRebarCalculator(supabaseCoefficientReader(await createServerSupabase()), input);
}

/** The quantity table (design S20.1 «بنود المواد»). */
export async function getQuantityTableView(projectId: string): Promise<QuantityTable> {
  return getQuantityTable(supabaseQuantityStore(await createServerSupabase()), projectId);
}

/** One line (design S20.2). null = not in this project. */
export async function getItemDetailView(projectId: string, itemId: string): Promise<ItemDetail | null> {
  return getItemDetail(supabaseQuantityStore(await createServerSupabase()), projectId, itemId);
}
