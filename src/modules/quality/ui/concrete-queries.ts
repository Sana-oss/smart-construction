// Reads for the concrete log. Server-only: the signed-in user's session (RLS applies).

import { todayInTripoli } from '@/shared-kernel';
import { createServerSupabase } from '@/platform/supabase/server';
import { getConcreteLog, getPour, type ConcreteLog, type PourRecord } from '../application/concrete';
import { supabasePourStore } from '../infra/supabase-pour-store';

const store = async () => supabasePourStore(await createServerSupabase());

export async function getConcreteLogView(projectId: string, phaseId: string | null = null): Promise<ConcreteLog> {
  return getConcreteLog(await store(), projectId, phaseId, todayInTripoli());
}

export async function getPourView(projectId: string, id: string): Promise<PourRecord | null> {
  return getPour(await store(), projectId, id);
}
