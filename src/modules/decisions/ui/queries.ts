// Reads for Server Components (pages). Server-only: uses the signed-in user's session cookie (RLS applies).
// decisions is level 3: it reads finance and materials through their public APIs, never their tables.

import { getCashflowView } from '@/modules/finance';
import { getProjectPriceWarnings } from '@/modules/materials';
import { createServerSupabase } from '@/platform/supabase/server';
import { buildComparison, type ComparisonView, type StoredComparison } from '../application/comparison';
import { supabaseComparisonStore } from '../infra/supabase-comparison-store';

/** S18.1. `project` comes from the projects module (the page); `today` is the date in Libya. */
export async function getComparison(
  project: { id: string; availableNowLyd: string | null; availableAsOf: string | null },
  today: string,
): Promise<ComparisonView> {
  const [stored, cash, warnings] = await Promise.all([
    supabaseComparisonStore(await createServerSupabase()).load(project.id),
    getCashflowView(project, today),
    getProjectPriceWarnings(project.id, today),
  ]);
  const movements = cash.items.map((m) => ({ kind: m.kind, amountLyd: m.amountLyd, date: m.date }));
  return buildComparison(stored, { liquidity: cash.liquidity?.amount ?? null, movements }, warnings, today);
}

/** The saved figures and review, for the forms (null when nothing is saved yet). */
export async function getStoredComparison(projectId: string): Promise<StoredComparison | null> {
  return supabaseComparisonStore(await createServerSupabase()).load(projectId);
}
