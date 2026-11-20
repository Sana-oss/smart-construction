// Reads for Server Components (pages). Server-only: uses the signed-in user's session cookie (RLS applies).

import { createServerSupabase } from '@/platform/supabase/server';
import {
  getChecklistCounts,
  getChecklistDetail,
  getPhaseChecklists,
  type ChecklistDetail,
  type ChecklistWithProgress,
  type TemplateRecord,
} from '../application/checklists';
import { supabaseChecklistStore } from '../infra/supabase-checklist-store';

const store = async () => supabaseChecklistStore(await createServerSupabase());

export async function getPhaseChecklistsView(projectId: string, phaseId: string): Promise<ChecklistWithProgress[]> {
  return getPhaseChecklists(await store(), projectId, phaseId);
}

export async function getChecklistCountsView(projectId: string): Promise<Record<string, { count: number; open: number }>> {
  return getChecklistCounts(await store(), projectId);
}

export async function getChecklistDetailView(projectId: string, checklistId: string): Promise<ChecklistDetail | null> {
  return getChecklistDetail(await store(), projectId, checklistId);
}

export async function getChecklistTemplates(): Promise<TemplateRecord[]> {
  return (await store()).listTemplates();
}
