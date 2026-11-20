// Reads for the defects screens. Server-only: the signed-in user's session (RLS applies).

import { createServerSupabase } from '@/platform/supabase/server';
import { supabaseFileStore } from '@/platform/supabase/storage';
import { getIssue, getIssues, openIssuesOfPhase, type IssueList, type IssueRecord } from '../application/issues';
import { supabaseIssueStore } from '../infra/supabase-issue-store';
import { issueTextAr } from './messages.ar';

const store = async () => supabaseIssueStore(await createServerSupabase());

export async function getIssueListView(projectId: string, phaseId: string | null = null): Promise<IssueList> {
  return getIssues(await store(), projectId, phaseId);
}

export async function getIssueView(projectId: string, id: string): Promise<{ issue: IssueRecord; photoUrl: string | null } | null> {
  const issue = await getIssue(await store(), projectId, id);
  if (!issue) return null;
  let photoUrl: string | null = null;
  if (issue.photoPath) photoUrl = (await supabaseFileStore(await createServerSupabase()).signedUrls([issue.photoPath], 10 * 60)).get(issue.photoPath) ?? null;
  return { issue, photoUrl };
}

/** FR-QLT-07: the phase's open defects, one line each, for the warning when the phase is finished. Empty = none. */
export async function getOpenIssuesOfPhaseAr(projectId: string, phaseId: string): Promise<string[]> {
  const open = await openIssuesOfPhase(await store(), projectId, phaseId);
  return open.map((i) => issueTextAr.gapLine(i.title, i.status === 'in_progress' ? 'in_progress' : 'open'));
}

/** Open defects per phase and in all, for the phase page and the dashboard. */
export async function getOpenIssueCounts(projectId: string): Promise<{ total: number; byPhase: Record<string, number> }> {
  const { issues } = await getIssues(await store(), projectId);
  const byPhase: Record<string, number> = {};
  let total = 0;
  for (const i of issues) {
    if (i.status === 'closed') continue;
    total += 1;
    if (i.phaseId) byPhase[i.phaseId] = (byPhase[i.phaseId] ?? 0) + 1;
  }
  return { total, byPhase };
}
