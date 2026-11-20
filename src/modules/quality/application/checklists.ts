import { IMAGE_MAX_STORED_BYTES, IMAGE_STORED_TYPE, isUuid, toDb, type Money } from '@/shared-kernel';
import type { FileStore } from '@/platform/supabase/storage';
import {
  checklistProgress,
  isCheckPhotoPathOf,
  photoRequirement,
  planProtectionCost,
  readinessGaps,
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
  type ReadinessGap,
} from '../domain/checklist';

// Use cases: pre-pour checkpoints (3.12, slice 1; FR-QLT-01, FR-QLT-02; design S26.1, S26.2). Run on the server as the
// signed-in user, under RLS. The database copies the template, stamps each check, completes the checklist, emits
// checklist.completed and audits every check (0025).

export interface TemplateRecord {
  id: string;
  kind: ChecklistKind;
  title: string;
  itemCount: number;
  status: 'unreviewed' | 'approved';
  source: string;
}

/**
 * 'hold_point' = pre-pour (3.12, one per pour of a phase); 'readiness' = the project's readiness list (3.15);
 * 'safe_stop' = a phase's stop plan (3.14, one per phase).
 */
export type ChecklistKind = 'hold_point' | 'readiness' | 'safe_stop';

export interface ChecklistRecord {
  id: string;
  kind: ChecklistKind;
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
  /** "<project id>/checklists/<id>.jpg" (slice 2), or null. */
  photoPath: string | null;
  /** 3.14: a stop-plan protection measure takes the owner's cost estimate. */
  takesCost: boolean;
  /** Canonical decimal string, or null. */
  costLyd: string | null;
}

export type ChecklistFailure =
  | 'not_allowed'
  | 'unknown_reference'
  | 'rejected'
  | 'not_found'
  /** The photo did not arrive in storage, or is not a JPEG within the size limit. */
  | 'photo_missing'
  | 'unavailable';

/** Port. The Supabase adapter is infra/supabase-checklist-store.ts; tests use a fake. */
export interface ChecklistStore {
  listTemplates(): Promise<TemplateRecord[]>;
  listChecklists(projectId: string): Promise<ChecklistRecord[]>;
  listItems(projectId: string): Promise<ChecklistItemRecord[]>;
  /** create_checklist (0025): the checklist and a copy of the template's items, in one transaction. */
  createChecklist(c: { projectId: string; phaseId: string; title: string; templateId: string }): Promise<{ status: 'done'; id: string } | { status: 'failed'; reason: ChecklistFailure }>;
  /** photoPath: the item's photo after this save (the new one, the one it had, or null). */
  recordCheck(itemId: string, check: CheckValue & { photoPath: string | null; costLyd: Money | null }): Promise<{ status: 'done' } | { status: 'failed'; reason: ChecklistFailure }>;
  /** create_readiness_checklist (0027): the project's readiness list; the same one when it exists. */
  createReadiness(projectId: string): Promise<{ status: 'done'; id: string } | { status: 'failed'; reason: ChecklistFailure }>;
  /** create_stop_plan (0028): the phase's stop plan; the same one when it exists. */
  createStopPlan(projectId: string, phaseId: string): Promise<{ status: 'done'; id: string } | { status: 'failed'; reason: ChecklistFailure }>;
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
    .filter((l) => l.kind === 'hold_point' && l.phaseId === phaseId)
    .sort(byCreated)
    .map((checklist) => ({ checklist, progress: checklistProgress(items.filter((i) => i.checklistId === checklist.id)) }));
}

/** For the phase page's link: how many checklists each phase has, and how many are still open. */
export async function getChecklistCounts(store: ChecklistStore, projectId: string): Promise<Record<string, { count: number; open: number }>> {
  const lists = await store.listChecklists(projectId);
  const counts: Record<string, { count: number; open: number }> = {};
  for (const l of lists) {
    if (l.kind !== 'hold_point' || !l.phaseId) continue;
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
    // Only a pre-pour template makes a phase's checklist (the readiness template is the project's, 3.15).
    template: (id) => templates.some((t) => t.id === id && t.kind === 'hold_point'),
  });
  if (!v.ok) return { ok: false, kind: 'invalid', errors: v.errors };
  const r = await store.createChecklist({ projectId, ...v.value });
  return r.status === 'done' ? { ok: true, id: r.id } : { ok: false, kind: 'failed', reason: r.reason };
}

export type RecordCheckResult =
  /** kind: where to go back after saving (a pre-pour checklist, or the readiness list). */
  | { ok: true; kind: ChecklistKind; phaseId: string | null }
  | { ok: false; kind: 'invalid'; errors: { field: CheckField; code: CheckErrorCode }[] }
  | { ok: false; kind: 'failed'; reason: ChecklistFailure };

export interface RecordCheckCommand extends CheckInput {
  /** A photo the browser has just uploaded for this item (slice 2), or empty to keep the item's photo. */
  photoPath?: string | null;
}

/**
 * FR-QLT-01 (design S26.2). The item must belong to this checklist of this project. With a new photo, the file is checked
 * in storage first; every way this ends without saving it removes it again (no file without an item), and a saved new
 * photo removes the one it replaces. The rule «سليم needs a photo» uses the photo the item will have after this save.
 * @param files Private file storage; needed only when the command brings a new photo.
 */
export async function recordCheck(
  store: ChecklistStore,
  projectId: string,
  checklistId: string,
  itemId: string,
  command: RecordCheckCommand,
  files?: FileStore,
): Promise<RecordCheckResult> {
  const newPhoto = command.photoPath?.trim() || null;
  // Only a path inside this project's checklists folder is ever looked at or removed (a browser could send any path).
  if (newPhoto !== null && (!files || !isCheckPhotoPathOf(projectId, newPhoto))) {
    return { ok: false, kind: 'failed', reason: 'not_allowed' };
  }
  const dropNewPhoto = async () => {
    if (newPhoto !== null) await files!.remove([newPhoto]);
  };

  const v = validateCheck(command);
  if (!v.ok) {
    await dropNewPhoto();
    return { ok: false, kind: 'invalid', errors: v.errors };
  }
  const detail = await getChecklistDetail(store, projectId, checklistId);
  const item = detail && isUuid(itemId) ? detail.items.find((i) => i.id === itemId.toLowerCase()) : undefined;
  if (!item) {
    await dropNewPhoto();
    return { ok: false, kind: 'failed', reason: 'not_found' };
  }

  if (newPhoto !== null) {
    const file = await files!.info(newPhoto);
    if (!file || file.contentType !== IMAGE_STORED_TYPE || file.sizeBytes > IMAGE_MAX_STORED_BYTES) {
      if (file) await dropNewPhoto();
      return { ok: false, kind: 'failed', reason: 'photo_missing' };
    }
  }

  const photoPath = newPhoto ?? item.photoPath;
  if (photoRequirement(v.value.result, item.requiresPhoto, photoPath !== null)) {
    await dropNewPhoto();
    return { ok: false, kind: 'invalid', errors: [{ field: 'photo', code: 'photo_required' }] };
  }

  // A cost belongs only on a stop-plan protection measure (the database refuses it elsewhere, 0028).
  const costLyd = item.takesCost ? v.value.costLyd : null;
  const r = await store.recordCheck(item.id, { ...v.value, costLyd, photoPath });
  if (r.status === 'failed') {
    await dropNewPhoto();
    return { ok: false, kind: 'failed', reason: r.reason };
  }
  // The new photo replaced an older one: the old file goes (the audit log keeps its path, 0025).
  if (newPhoto !== null && item.photoPath !== null && item.photoPath !== newPhoto) await files!.remove([item.photoPath]);
  return { ok: true, kind: detail!.checklist.kind, phaseId: detail!.checklist.phaseId };
}

// ---------------------------------------------------------------------------------------------------------------
// The project's readiness list (3.15; FR-PRJ-05)

export interface ReadinessView {
  /** null = not created yet. */
  detail: ChecklistDetail | null;
  /** Missing or not reviewed: what the gate shows when a phase starts. */
  gaps: ReadinessGap[];
}

export async function getReadiness(store: ChecklistStore, projectId: string): Promise<ReadinessView> {
  const lists = await store.listChecklists(projectId);
  const readiness = lists.find((l) => l.kind === 'readiness');
  if (!readiness) return { detail: null, gaps: [] };
  const detail = await getChecklistDetail(store, projectId, readiness.id);
  return { detail, gaps: detail ? readinessGaps(detail.items) : [] };
}

/** Creates the project's readiness list from the template (or finds it). */
export async function ensureReadiness(store: ChecklistStore, projectId: string) {
  return store.createReadiness(projectId);
}

// ---------------------------------------------------------------------------------------------------------------
// A phase's stop plan (3.14; FR-DEC-04)

export interface StopPlanView {
  /** null = not created yet for this phase. */
  detail: ChecklistDetail | null;
  /** The owner's estimates for the protection measures (null = none typed). Fills the stop scenario's protection cost. */
  protectionCost: Money | null;
}

export async function getStopPlan(store: ChecklistStore, projectId: string, phaseId: string): Promise<StopPlanView> {
  const plan = (await store.listChecklists(projectId)).find((l) => l.kind === 'safe_stop' && l.phaseId === phaseId);
  if (!plan) return { detail: null, protectionCost: null };
  const detail = await getChecklistDetail(store, projectId, plan.id);
  return { detail, protectionCost: detail ? planProtectionCost(detail.items) : null };
}

/** Creates the phase's stop plan from the template (or finds it). The phase must be one of the project's. */
export async function ensureStopPlan(store: ChecklistStore, projectId: string, phaseIds: string[], phaseId: string) {
  if (!phaseIds.includes(phaseId)) return { status: 'failed' as const, reason: 'unknown_reference' as const };
  return store.createStopPlan(projectId, phaseId);
}

/** Display string of a plan's protection cost (for the stop scenario's form). */
export const protectionCostText = (m: Money | null) => (m === null ? null : toDb(m));
