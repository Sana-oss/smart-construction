// Reads for Server Components (pages). Server-only: uses the signed-in user's session cookie (RLS applies).

import { createServerSupabase } from '@/platform/supabase/server';
import { supabaseFileStore } from '@/platform/supabase/storage';
import {
  getChecklistCounts,
  getChecklistDetail,
  getPhaseChecklists,
  getReadiness,
  type ChecklistDetail,
  type ChecklistWithProgress,
  type ReadinessView,
  type TemplateRecord,
} from '../application/checklists';
import { supabaseChecklistStore } from '../infra/supabase-checklist-store';
import { readinessTextAr } from './messages.ar';

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

/** The templates a phase's pre-pour checklist can copy (not the project's readiness template, 3.15). */
export async function getChecklistTemplates(): Promise<TemplateRecord[]> {
  return (await (await store()).listTemplates()).filter((t) => t.kind === 'hold_point');
}

/** A short-lived link to an item's photo (NFR-SEC-03: private bucket), or null when it is not readable. */
export async function getCheckPhotoUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const urls = await supabaseFileStore(await createServerSupabase()).signedUrls([path], 10 * 60);
  return urls.get(path) ?? null;
}

/** The project's readiness list and its gaps (3.15). */
export async function getReadinessView(projectId: string): Promise<ReadinessView> {
  return getReadiness(await store(), projectId);
}

/**
 * What the gate shows when a phase starts (FR-PRJ-05), one line per gap. With no list yet, that is the one gap.
 * Empty = ready. Formatted here (quality's own words) so the app passes plain text to the projects module.
 */
export async function getReadinessGapsAr(projectId: string): Promise<string[]> {
  const view = await getReadiness(await store(), projectId);
  if (!view.detail) return [readinessTextAr.notCreated];
  return view.gaps.map((g) => readinessTextAr.gap(g.text, g.state));
}
