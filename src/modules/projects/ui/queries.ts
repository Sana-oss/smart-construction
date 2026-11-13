// Reads for Server Components (pages). Server-only: they use the signed-in user's session cookie, so RLS applies.

import { createServerSupabase } from '@/platform/supabase/server';
import type { MyProject, TemplatePhase } from '../application/project-gateway';
import { supabaseProjectGateway } from '../infra/supabase-project-gateway';

export async function getMyProject(): Promise<MyProject | null> {
  return supabaseProjectGateway(await createServerSupabase()).myProject();
}

export async function getPhaseTemplate(): Promise<TemplatePhase[]> {
  return supabaseProjectGateway(await createServerSupabase()).phaseTemplate();
}
