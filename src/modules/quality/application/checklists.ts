import { isUuid } from '@/shared-kernel';
import {
  checklistProgress,
  validateCheck,
  validateNewChecklist,
  type CheckErrorCode,
  type CheckField,
  type CheckInput,
  type CheckResult,
  type CheckValue,
  type ChecklistProgress,
  type NewChecklistField,
  type NewChecklistInput,
} from '../domain/checklist';

// Use cases: pre-pour checkpoints (3.12, slice 1; FR-QLT-01, FR-QLT-02; design S26.1, S26.2). Run on the server as the
// signed-in user, under RLS. The database copies the template, stamps each check, completes the checklist, emits
// checklist.completed and audits every check (0025).

export interface TemplateRecord {
  id: string;
  title: string;
  itemCount: number;
  status: 'unreviewed' | 'approved';
  source: string;
}

export interface ChecklistRecord {
  id: string;
  phaseId: string | null;
  title: string;
  status: 'open' | 'completed';
  /** The review status of the template when this checklist was copied from it. */
  templateStatus: 'unreviewed' | 'approved';
  createdAt: string;
}

export interface ChecklistItemRecord {
  id: string;
  checklistId: string;
  position: number;
  text: string;
  requiresPhoto: boolean;
  result: CheckResult | null;
  note: string | null;
  responsible: string | null;
  recheckOn: string | null;
  /** When it was checked (ISO timestamp), or null. */
  checkedAt: string | null;
}

export type ChecklistFailure = 'not_allowed' | 'unknown_reference' | 'rejected' | 'not_found' | 'unavailable';

/** Port. The Supabase adapter is infra/supabase-checklist-store.ts; tests use a fake. */
export interface ChecklistStore {
  listTemplates(): Promise<TemplateRecord[]>;
  listChecklists(projectId: string): Promise<ChecklistRecord[]>;
  listItems(projectId: string): Promise<ChecklistItemRecord[]>;
  /** create_checklist (0025): the checklist and a copy of the template's items, in one transaction. */
  createChecklist(c: { projectId: string; phaseId: string; title: string; templateId: string }): Promise<{ status: 'done'; id: string } | { status: 'failed'; reason: ChecklistFailure }>;
  recordCheck(itemId: string, check: CheckValue): Promise<{ status: 'done' } | { status: 'failed'; reason: ChecklistFailure }>;
}

// ---------------------------------------------------------------------------------------------------------------
// Reads

export interface ChecklistWithProgress {
  checklist: ChecklistRecord;
  progress: ChecklistProgress;
}

const byCreated = (a: ChecklistRecord, b: ChecklistRecord) => b.createdAt.localeCompare(a.createdAt);

/** The checklists of one phase, newest first, with «x من y». */
export async function getPhaseChecklists(store: ChecklistStore, projectId: string, phaseId: string): Promise<ChecklistWithProgress[]> {
  const [lists, items] = await Promise.all([store.listChecklists(projectId), store.listItems(projectId)]);
  return lists
    .filter((l) => l.phaseId === phaseId)
    .sort(byCreated)
    .map((checklist) => ({ checklist, progress: checklistProgress(items.filter((i) => i.checklistId === checklist.id)) }));
}

/** For the phase page's link: how many checklists each phase has, and how many are still open. */
export async function getChecklistCounts(store: ChecklistStore, projectId: string): Promise<Record<string, { count: number; open: number }>> {
  const lists = await store.listChecklists(projectId);
  const counts: Record<string, { count: number; open: number }> = {};
  for (const l of lists) {
    if (!l.phaseId) continue;
    const c = (counts[l.phaseId] ??= { count: 0, open: 0 });
    c.count += 1;
    if (l.status === 'open') c.open += 1;
  }
  return counts;
}

export interface ChecklistDetail extends ChecklistWithProgress {
  /** In the template's order. */
  items: ChecklistItemRecord[];
}

/** Design S26.1. null = not in this project (or not visible to this user). */
export async function getChecklistDetail(store: ChecklistStore, projectId: string, checklistId: string): Promise<ChecklistDetail | null> {
  if (!isUuid(checklistId)) return null;
  const [lists, items] = await Promise.all([store.listChecklists(projectId), store.listItems(projectId)]);
  const checklist = lists.find((l) => l.id === checklistId.toLowerCase());
  if (!checklist) return null;
  const mine = items.filter((i) => i.checklistId === checklist.id).sort((a, b) => a.position - b.position);
  return { checklist, items: mine, progress: checklistProgress(mine) };
}

// ---------------------------------------------------------------------------------------------------------------
// Writes

export type CreateChecklistResult =
  | { ok: true; id: string }
  | { ok: false; kind: 'invalid'; errors: { field: NewChecklistField; code: CheckErrorCode }[] }
  | { ok: false; kind: 'failed'; reason: ChecklistFailure };

/** FR-QLT-02. @param phaseIds the project's phases (from the projects module). */
export async function createChecklist(store: ChecklistStore, projectId: string, phaseIds: string[], input: NewChecklistInput): Promise<CreateChecklistResult> {
  const templates = await store.listTemplates();
  const v = validateNewChecklist(input, {
    phase: (id) => phaseIds.includes(id),
    template: (id) => templates.some((t) => t.id === id),
  });
  if (!v.ok) return { ok: false, kind: 'invalid', errors: v.errors };
  const r = await store.createChecklist({ projectId, ...v.value });
  return r.status === 'done' ? { ok: true, id: r.id } : { ok: false, kind: 'failed', reason: r.reason };
}

export type RecordCheckResult =
  | { ok: true }
  | { ok: false; kind: 'invalid'; errors: { field: CheckField; code: CheckErrorCode }[] }
  | { ok: false; kind: 'failed'; reason: ChecklistFailure };

/** FR-QLT-01 (design S26.2). The item must belong to this checklist of this project. */
export async function recordCheck(store: ChecklistStore, projectId: string, checklistId: string, itemId: string, input: CheckInput): Promise<RecordCheckResult> {
  const v = validateCheck(input);
  if (!v.ok) return { ok: false, kind: 'invalid', errors: v.errors };
  const detail = await getChecklistDetail(store, projectId, checklistId);
  if (!detail || !isUuid(itemId) || !detail.items.some((i) => i.id === itemId.toLowerCase())) {
    return { ok: false, kind: 'failed', reason: 'not_found' };
  }
  const r = await store.recordCheck(itemId.toLowerCase(), v.value);
  return r.status === 'done' ? { ok: true } : { ok: false, kind: 'failed', reason: r.reason };
}
