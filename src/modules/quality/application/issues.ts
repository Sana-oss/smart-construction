import { IMAGE_MAX_STORED_BYTES, IMAGE_STORED_TYPE, isUuid } from '@/shared-kernel';
import type { FileStore } from '@/platform/supabase/storage';
import {
  isIssueStatus,
  isOpenIssue,
  sortIssues,
  validateIssue,
  type IssueError,
  type IssueInput,
  type IssueSeverity,
  type IssueStatus,
} from '../domain/issue';

// Use cases: the defects list (3.17; FR-QLT-06, FR-QLT-07; design S28.1, S28.2, S28.3). Run on the server as the signed-in
// user, under RLS. The database dates each state and audits every change (0029).

export interface IssueRecord {
  id: string;
  title: string;
  location: string | null;
  description: string | null;
  responsible: string | null;
  severity: IssueSeverity;
  status: IssueStatus;
  phaseId: string | null;
  checklistId: string | null;
  dueOn: string | null;
  photoPath: string | null;
  createdAt: string;
  startedAt: string | null;
  closedAt: string | null;
}

export type IssueFailure = 'not_allowed' | 'unknown_reference' | 'rejected' | 'not_found' | 'photo_missing' | 'unavailable';

export type NewIssueRecord = Omit<IssueRecord, 'id' | 'status' | 'createdAt' | 'startedAt' | 'closedAt'>;

/** Port. The Supabase adapter is infra/supabase-issue-store.ts; tests use a fake. */
export interface IssueStore {
  list(projectId: string): Promise<IssueRecord[]>;
  /** The project's checklists, to check a «تسجيل عيب مرتبط» link (same module, its own table). */
  checklistIds(projectId: string): Promise<string[]>;
  add(projectId: string, issue: NewIssueRecord): Promise<{ status: 'done'; id: string } | { status: 'failed'; reason: IssueFailure }>;
  setStatus(projectId: string, id: string, status: IssueStatus): Promise<{ status: 'done' } | { status: 'failed'; reason: IssueFailure }>;
  setPhoto(projectId: string, id: string, photoPath: string): Promise<{ status: 'done' } | { status: 'failed'; reason: IssueFailure }>;
}

/** Only a path inside this project's issues folder is ever looked at or removed (a browser could send any path). */
export function isIssuePhotoPathOf(projectId: string, path: string): boolean {
  const m = /^([0-9a-f-]{36})\/issues\/([0-9a-f-]{36})\.jpg$/.exec(path);
  return m !== null && m[1] === projectId && isUuid(m[1]) && isUuid(m[2]);
}

/** "<project id>/issues/<id>.jpg": a fresh id per upload. */
export function issuePhotoStoragePath(projectId: string, photoId: string): string {
  if (!isUuid(projectId) || !isUuid(photoId)) throw new Error('issuePhotoStoragePath needs two uuids');
  return `${projectId}/issues/${photoId}.jpg`;
}

/** The uploaded photo is a JPEG within the size limit (the browser compressed it). */
async function photoArrived(files: FileStore, path: string): Promise<boolean> {
  const file = await files.info(path);
  if (!file || file.contentType !== IMAGE_STORED_TYPE || file.sizeBytes > IMAGE_MAX_STORED_BYTES) {
    if (file) await files.remove([path]);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------------------------------------------
// Reads

export interface IssueList {
  /** S28.1's order: unresolved first, higher priority, newest. */
  issues: IssueRecord[];
  openCount: number;
}

/** @param phaseId only this phase's defects, or all of the project's. */
export async function getIssues(store: IssueStore, projectId: string, phaseId: string | null = null): Promise<IssueList> {
  const all = await store.list(projectId);
  const issues = sortIssues(phaseId ? all.filter((i) => i.phaseId === phaseId) : all);
  return { issues, openCount: issues.filter(isOpenIssue).length };
}

export async function getIssue(store: IssueStore, projectId: string, id: string): Promise<IssueRecord | null> {
  if (!isUuid(id)) return null;
  return (await store.list(projectId)).find((i) => i.id === id.toLowerCase()) ?? null;
}

/** FR-QLT-07: what is still open in a phase, for the warning when the phase is finished. */
export async function openIssuesOfPhase(store: IssueStore, projectId: string, phaseId: string): Promise<IssueRecord[]> {
  return (await getIssues(store, projectId, phaseId)).issues.filter(isOpenIssue);
}

// ---------------------------------------------------------------------------------------------------------------
// Writes

export type AddIssueResult =
  | { ok: true; id: string }
  | { ok: false; kind: 'invalid'; errors: IssueError[] }
  | { ok: false; kind: 'failed'; reason: IssueFailure };

/**
 * FR-QLT-06 (design S28.2). With a photo just uploaded: it is checked in storage, and every way this ends without saving
 * removes it again (no file without a defect).
 * @param phaseIds the project's phases (from the projects module, through the session).
 */
export async function addIssue(
  store: IssueStore,
  projectId: string,
  phaseIds: string[],
  input: IssueInput & { photoPath?: string | null },
  files?: FileStore,
): Promise<AddIssueResult> {
  const photo = input.photoPath?.trim() || null;
  if (photo !== null && (!files || !isIssuePhotoPathOf(projectId, photo))) return { ok: false, kind: 'failed', reason: 'not_allowed' };
  const drop = async () => {
    if (photo !== null) await files!.remove([photo]);
  };

  const checklists = await store.checklistIds(projectId);
  const v = validateIssue(input, { phase: (id) => phaseIds.includes(id), checklist: (id) => checklists.includes(id) });
  if (!v.ok) {
    await drop();
    return { ok: false, kind: 'invalid', errors: v.errors };
  }
  if (photo !== null && !(await photoArrived(files!, photo))) return { ok: false, kind: 'failed', reason: 'photo_missing' };

  const r = await store.add(projectId, { ...v.value, photoPath: photo });
  if (r.status === 'failed') {
    await drop();
    return { ok: false, kind: 'failed', reason: r.reason };
  }
  return { ok: true, id: r.id };
}

/** FR-QLT-06 (design S28.3): open, being fixed, closed; reopening is allowed (the database dates each state). */
export async function changeIssueStatus(store: IssueStore, projectId: string, id: string, status: string) {
  if (!isUuid(id) || !isIssueStatus(status)) return { status: 'failed' as const, reason: 'rejected' as const };
  return store.setStatus(projectId, id.toLowerCase(), status);
}

/** One replaceable photo per defect: the new file replaces the old one, which is removed (the audit keeps its path). */
export async function replaceIssuePhoto(store: IssueStore, projectId: string, id: string, photoPath: string, files: FileStore) {
  if (!isIssuePhotoPathOf(projectId, photoPath)) return { status: 'failed' as const, reason: 'not_allowed' as const };
  const issue = await getIssue(store, projectId, id);
  if (!issue) {
    await files.remove([photoPath]);
    return { status: 'failed' as const, reason: 'not_found' as const };
  }
  if (!(await photoArrived(files, photoPath))) return { status: 'failed' as const, reason: 'photo_missing' as const };
  const r = await store.setPhoto(projectId, issue.id, photoPath);
  if (r.status === 'failed') {
    await files.remove([photoPath]);
    return r;
  }
  if (issue.photoPath && issue.photoPath !== photoPath) await files.remove([issue.photoPath]);
  return r;
}
