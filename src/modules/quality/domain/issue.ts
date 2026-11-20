import { isIsoDate, isUuid } from '@/shared-kernel';

// Defects and notes, the snag list (3.17; FR-QLT-06, FR-QLT-07; design S28.1 «سجل العيوب», S28.2 «تسجيل عيب», S28.3
// «متابعة العيب»). Pure: no React, no database.
//
// The priority is the owner's label for the list's order, not an engineering judgement: the design says it is
// «توضيحي ويحدده المهندس بعد المعاينة», and the screen says so.

/** FR-QLT-06: open, being fixed, closed (0002). */
export const ISSUE_STATUSES = ['open', 'in_progress', 'closed'] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

/** Stored as 0001's severity column; shown as «منخفضة / متوسطة / عالية». */
export const ISSUE_SEVERITIES = ['minor', 'major', 'critical'] as const;
export type IssueSeverity = (typeof ISSUE_SEVERITIES)[number];

/** Project decisions (20 Nov 2026), like the other text fields. */
export const ISSUE_TITLE_MIN = 2;
export const ISSUE_TITLE_MAX = 80;
export const ISSUE_LOCATION_MAX = 80;
export const ISSUE_RESPONSIBLE_MAX = 80;
export const ISSUE_DESCRIPTION_MAX = 500;

export type IssueField = 'title' | 'location' | 'description' | 'responsible' | 'severity' | 'phaseId' | 'dueOn' | 'checklistId';
export type IssueErrorCode = 'required' | 'too_short' | 'too_long' | 'unknown_choice' | 'invalid_date' | 'invalid_reference';
export interface IssueError {
  field: IssueField;
  code: IssueErrorCode;
}

/** What the S28.2 form sends, as typed. */
export interface IssueInput {
  title?: string | null;
  /** «الموقع» inside the building, e.g. «الدور الأرضي · المحور ب». */
  location?: string | null;
  description?: string | null;
  responsible?: string | null;
  severity?: string | null;
  phaseId?: string | null;
  /** «موعد المعالجة»: planned, so it may be in the future. */
  dueOn?: string | null;
  /** The checklist the defect was raised from (S26.2 «تسجيل عيب مرتبط»), if any. */
  checklistId?: string | null;
}

export interface NewIssue {
  title: string;
  location: string | null;
  description: string | null;
  responsible: string | null;
  severity: IssueSeverity;
  phaseId: string | null;
  dueOn: string | null;
  checklistId: string | null;
}

const clean = (s: string | null | undefined) => (s ?? '').trim().replace(/\s+/g, ' ');
const length = (s: string) => [...s].length;

/** @param isKnown the project's phases and checklists (from the session, never from the form). */
export function validateIssue(
  input: IssueInput,
  isKnown: { phase: (id: string) => boolean; checklist: (id: string) => boolean },
): { ok: true; value: NewIssue } | { ok: false; errors: IssueError[] } {
  const errors: IssueError[] = [];
  const push = (field: IssueField, code: IssueErrorCode) => errors.push({ field, code });

  const title = clean(input.title);
  if (title === '') push('title', 'required');
  else if (length(title) < ISSUE_TITLE_MIN) push('title', 'too_short');
  else if (length(title) > ISSUE_TITLE_MAX) push('title', 'too_long');

  const optionalText = (field: IssueField, raw: string | null | undefined, max: number) => {
    const v = field === 'description' ? (raw ?? '').trim() || null : clean(raw) || null;
    if (v !== null && length(v) > max) push(field, 'too_long');
    return v;
  };
  const location = optionalText('location', input.location, ISSUE_LOCATION_MAX);
  const description = optionalText('description', input.description, ISSUE_DESCRIPTION_MAX);
  const responsible = optionalText('responsible', input.responsible, ISSUE_RESPONSIBLE_MAX);

  const severity = clean(input.severity);
  if (severity === '') push('severity', 'required');
  else if (!(ISSUE_SEVERITIES as readonly string[]).includes(severity)) push('severity', 'unknown_choice');

  const phaseId = clean(input.phaseId).toLowerCase() || null;
  if (phaseId !== null && !isKnown.phase(phaseId)) push('phaseId', 'invalid_reference');

  const dueOn = (input.dueOn ?? '').trim() || null;
  if (dueOn !== null && !isIsoDate(dueOn)) push('dueOn', 'invalid_date');

  const checklistId = clean(input.checklistId).toLowerCase() || null;
  if (checklistId !== null && (!isUuid(checklistId) || !isKnown.checklist(checklistId))) push('checklistId', 'invalid_reference');

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { title, location, description, responsible, severity: severity as IssueSeverity, phaseId, dueOn, checklistId } };
}

export const isIssueStatus = (s: unknown): s is IssueStatus => typeof s === 'string' && (ISSUE_STATUSES as readonly string[]).includes(s);

/** Not closed: what the dashboard counts and what warns when a phase is finished (FR-QLT-07). */
export const isOpenIssue = (i: { status: IssueStatus }) => i.status !== 'closed';

const SEVERITY_RANK: Record<IssueSeverity, number> = { critical: 0, major: 1, minor: 2 };
const STATUS_RANK: Record<IssueStatus, number> = { open: 0, in_progress: 1, closed: 2 };

/** S28.1's order: unresolved first, then the higher priority, then the newest. */
export function sortIssues<T extends { status: IssueStatus; severity: IssueSeverity; createdAt: string }>(issues: T[]): T[] {
  return [...issues].sort(
    (a, b) =>
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      b.createdAt.localeCompare(a.createdAt),
  );
}
