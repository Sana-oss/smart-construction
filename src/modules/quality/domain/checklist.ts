import { addMoney, isIsoDate, isUuid, money, readMoneyInput, type Money, type MoneyInputError } from '@/shared-kernel';

// Pre-pour and pre-cover checkpoints (3.12; FR-QLT-01, FR-QLT-02; design S26.1 «قائمة الفحص», S26.2 «تفاصيل بند الفحص»).
// Pure: no React, no database.
//
// Engineering content: the items come from a template that is DATA with a review status (checklist_templates, 0025).
// The system documents a check and warns; it never certifies safety (FR-SYS-05). That is why a sound item is called
// «سليم» and never «معتمد»: only the engineer approves.

/** FR-QLT-01: sound, a problem, not applicable. No result yet = «لم يُفحص». */
export const CHECK_RESULTS = ['ok', 'issue', 'na'] as const;
export type CheckResult = (typeof CHECK_RESULTS)[number];

/** Project decisions (20 Nov 2026), like the other text fields. */
export const CHECKLIST_TITLE_MIN = 2;
export const CHECKLIST_TITLE_MAX = 80;
export const CHECK_NOTE_MAX = 200;
export const RESPONSIBLE_MAX = 80;

export type CheckErrorCode =
  | 'required'
  | 'too_short'
  | 'too_long'
  | 'unknown_choice'
  | 'invalid_date'
  | 'invalid_reference'
  /** FR-QLT-01: an item that requires a photo is not «سليم» without one. */
  | 'photo_required'
  /** A cost typed on a stop-plan protection measure (3.14). */
  | MoneyInputError;

const clean = (s: string | null | undefined) => (s ?? '').trim().replace(/\s+/g, ' ');
const length = (s: string) => [...s].length;

// ---------------------------------------------------------------------------------------------------------------
// A new checklist for a phase: a name (one phase has several pours) and the template it copies.

export type NewChecklistField = 'title' | 'phaseId' | 'templateId';
export interface NewChecklistInput {
  title?: string | null;
  phaseId?: string | null;
  templateId?: string | null;
}

export function validateNewChecklist(
  input: NewChecklistInput,
  isKnown: { phase: (id: string) => boolean; template: (id: string) => boolean },
): { ok: true; value: { title: string; phaseId: string; templateId: string } } | { ok: false; errors: { field: NewChecklistField; code: CheckErrorCode }[] } {
  const errors: { field: NewChecklistField; code: CheckErrorCode }[] = [];
  const title = clean(input.title);
  if (title === '') errors.push({ field: 'title', code: 'required' });
  else if (length(title) < CHECKLIST_TITLE_MIN) errors.push({ field: 'title', code: 'too_short' });
  else if (length(title) > CHECKLIST_TITLE_MAX) errors.push({ field: 'title', code: 'too_long' });

  const phaseId = clean(input.phaseId).toLowerCase();
  if (phaseId === '') errors.push({ field: 'phaseId', code: 'required' });
  else if (!isKnown.phase(phaseId)) errors.push({ field: 'phaseId', code: 'invalid_reference' });

  const templateId = clean(input.templateId).toLowerCase();
  if (templateId === '') errors.push({ field: 'templateId', code: 'required' });
  else if (!isKnown.template(templateId)) errors.push({ field: 'templateId', code: 'invalid_reference' });

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: { title, phaseId, templateId } };
}

// ---------------------------------------------------------------------------------------------------------------
// Recording the check of one item (S26.2).

export type CheckField = 'result' | 'note' | 'responsible' | 'recheckOn' | 'photo' | 'cost';
export interface CheckInput {
  result?: string | null;
  note?: string | null;
  /** «المسؤول عن المعالجة», e.g. the structure contractor. */
  responsible?: string | null;
  /** «موعد إعادة الفحص»: when the item is checked again. */
  recheckOn?: string | null;
  /**
   * 3.14: the owner's estimate for a stop-plan protection measure (a quote, or the contractor's figure), in LYD. Empty =
   * none. The app never suggests a cost.
   */
  cost?: string | null;
}
export interface CheckValue {
  result: CheckResult;
  note: string | null;
  responsible: string | null;
  recheckOn: string | null;
  costLyd: Money | null;
}

export function validateCheck(input: CheckInput): { ok: true; value: CheckValue } | { ok: false; errors: { field: CheckField; code: CheckErrorCode }[] } {
  const errors: { field: CheckField; code: CheckErrorCode }[] = [];
  const result = clean(input.result);
  if (result === '') errors.push({ field: 'result', code: 'required' });
  else if (!(CHECK_RESULTS as readonly string[]).includes(result)) errors.push({ field: 'result', code: 'unknown_choice' });

  const note = clean(input.note) || null;
  if (note !== null && length(note) > CHECK_NOTE_MAX) errors.push({ field: 'note', code: 'too_long' });
  const responsible = clean(input.responsible) || null;
  if (responsible !== null && length(responsible) > RESPONSIBLE_MAX) errors.push({ field: 'responsible', code: 'too_long' });

  // A re-inspection is planned: it may be today or later, so there is no "not in the future" rule here.
  const recheckOn = (input.recheckOn ?? '').trim() || null;
  if (recheckOn !== null && !isIsoDate(recheckOn)) errors.push({ field: 'recheckOn', code: 'invalid_date' });

  // A cost may be 0 (a measure the owner does himself), never negative.
  let costLyd: Money | null = null;
  if ((input.cost ?? '').trim() !== '') {
    const c = readMoneyInput(input.cost, { allowZero: true });
    if (c.ok) costLyd = c.value;
    else errors.push({ field: 'cost', code: c.code });
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: { result: result as CheckResult, note, responsible, recheckOn, costLyd } };
}

// ---------------------------------------------------------------------------------------------------------------
// Where a checklist stands (S26.1 «8 من 12 بندًا»).

export interface ItemState {
  result: CheckResult | null;
}

export interface ChecklistProgress {
  total: number;
  /** Items with a result (sound, a problem or not applicable). */
  checked: number;
  issues: number;
  unchecked: number;
  /** Every item has a result. Problems do not stop completion: the list records them (decision D2: warn, never block). */
  complete: boolean;
}

export function checklistProgress(items: ItemState[]): ChecklistProgress {
  const checked = items.filter((i) => i.result !== null).length;
  return {
    total: items.length,
    checked,
    issues: items.filter((i) => i.result === 'issue').length,
    unchecked: items.length - checked,
    complete: items.length > 0 && checked === items.length,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// The item photo (slice 2; FR-QLT-01). One photo per item, replaceable. Compressed in the browser like site photos and
// receipts (shared-kernel/images.ts), stored in the private bucket of 0013 under the project's folder.

/** "<project id>/checklists/<id>.jpg". A fresh id per upload: a retried save never overwrites a stored photo. */
export function checkPhotoStoragePath(projectId: string, photoId: string): string {
  if (!isUuid(projectId) || !isUuid(photoId)) throw new Error('checkPhotoStoragePath needs two uuids');
  return `${projectId}/checklists/${photoId}.jpg`;
}

/** True only for a checklist photo path of THIS project (a browser could send any path). */
export function isCheckPhotoPathOf(projectId: string, path: string): boolean {
  const m = /^([0-9a-f-]{36})\/checklists\/([0-9a-f-]{36})\.jpg$/.exec(path);
  return m !== null && m[1] === projectId && isUuid(m[1]) && isUuid(m[2]);
}

/**
 * FR-QLT-01: «بند إلزامي الصورة لا يُعلَّم سليمًا دون صورة». Only «سليم» needs it: a problem or «لا ينطبق» is recorded as
 * it is (decision D2: the system documents, it never blocks recording a problem). Which items require a photo is data on
 * the template, not code.
 */
export function photoRequirement(result: CheckResult, requiresPhoto: boolean, hasPhoto: boolean): 'photo_required' | null {
  return result === 'ok' && requiresPhoto && !hasPhoto ? 'photo_required' : null;
}

// ---------------------------------------------------------------------------------------------------------------
// The project's readiness list (3.15; FR-PRJ-05). Same engine, its own template.

export interface ReadinessGap {
  text: string;
  /** «ناقص» (recorded as missing) or not reviewed yet. */
  state: 'missing' | 'unchecked';
}

/** What is not ready: every item recorded as missing, or not reviewed yet. «لا ينطبق» is not a gap. */
export function readinessGaps(items: { text: string; result: CheckResult | null; position: number }[]): ReadinessGap[] {
  return [...items]
    .sort((a, b) => a.position - b.position)
    .filter((i) => i.result === null || i.result === 'issue')
    .map((i) => ({ text: i.text, state: i.result === 'issue' ? 'missing' : 'unchecked' }));
}

// ---------------------------------------------------------------------------------------------------------------
// A phase's stop plan (3.14; FR-DEC-04). Same engine, its own template; its protection measures take a cost.

/**
 * What the protection measures of a stop plan cost, from the owner's estimates: the sum of the costed items, except
 * those marked «لا ينطبق». It fills the stop scenario's protection cost (3.7), where the owner can still change it.
 * null = no cost typed yet (so the scenario is not given a 0 that nobody estimated).
 */
export function planProtectionCost(items: { takesCost: boolean; costLyd: string | null; result: CheckResult | null }[]): Money | null {
  const costed = items.filter((i) => i.takesCost && i.costLyd !== null && i.result !== 'na');
  return costed.length === 0 ? null : addMoney(...costed.map((i) => money(i.costLyd!)));
}
