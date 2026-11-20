import { isUuid } from '@/shared-kernel';
import Decimal from 'decimal.js';
import { dueReminders, pourTotals, validatePour, type PourError, type PourInput, type Reminder, type ReminderKind } from '../domain/concrete';

// Use cases: the concrete log (3.13; FR-QLT-04, FR-QLT-05; design S27.1, S27.2). Run on the server as the signed-in user,
// under RLS. The database stamps «تمّ» and audits every change and deletion (0030).

export interface PourRecord {
  id: string;
  /** «عنصر الصب» (0002's location). */
  element: string;
  pouredOn: string;
  supplier: string;
  /** Canonical decimal string. */
  qtyM3: string;
  cubeSamples: number;
  mixRef: string | null;
  deliveryRef: string | null;
  phaseId: string | null;
  curingUntil: string | null;
  formworkOn: string | null;
  curingDoneAt: string | null;
  formworkDoneAt: string | null;
  note: string | null;
  createdAt: string;
}

export type PourFailure = 'not_allowed' | 'unknown_reference' | 'rejected' | 'not_found' | 'unavailable';

export interface NewPourRecord {
  element: string;
  pouredOn: string;
  supplier: string;
  qtyM3: string;
  cubeSamples: number;
  mixRef: string | null;
  deliveryRef: string | null;
  phaseId: string | null;
  curingUntil: string | null;
  formworkOn: string | null;
  note: string | null;
  clientOpId: string;
}

/** Port. The Supabase adapter is infra/supabase-pour-store.ts; tests use a fake. */
export interface PourStore {
  list(projectId: string): Promise<PourRecord[]>;
  /** Idempotent on clientOpId: a resent form returns the pour stored the first time. */
  add(projectId: string, pour: NewPourRecord): Promise<{ status: 'done'; id: string } | { status: 'failed'; reason: PourFailure }>;
  /** Marks a reminder done (the database stamps when), or undoes it. */
  setDone(projectId: string, id: string, kind: ReminderKind, done: boolean): Promise<{ status: 'done' } | { status: 'failed'; reason: PourFailure }>;
  remove(projectId: string, id: string): Promise<{ status: 'done' } | { status: 'failed'; reason: PourFailure }>;
}

// ---------------------------------------------------------------------------------------------------------------
// Reads

export interface ConcreteLog {
  /** Newest pour first. */
  pours: PourRecord[];
  totalM3: Decimal;
  count: number;
  /** FR-QLT-05: due or late, most urgent first. */
  reminders: Reminder[];
}

const forReminders = (p: PourRecord) => ({
  id: p.id,
  element: p.element,
  curingUntil: p.curingUntil,
  curingDone: p.curingDoneAt !== null,
  formworkOn: p.formworkOn,
  formworkDone: p.formworkDoneAt !== null,
});

/** Design S27.1, of the project or of one phase. @param today the date in Libya. */
export async function getConcreteLog(store: PourStore, projectId: string, phaseId: string | null, today: string): Promise<ConcreteLog> {
  const all = await store.list(projectId);
  const pours = (phaseId ? all.filter((p) => p.phaseId === phaseId) : all).sort(
    (a, b) => b.pouredOn.localeCompare(a.pouredOn) || b.createdAt.localeCompare(a.createdAt),
  );
  const { totalM3, count } = pourTotals(pours);
  return { pours, totalM3, count, reminders: dueReminders(pours.map(forReminders), today) };
}

export async function getPour(store: PourStore, projectId: string, id: string): Promise<PourRecord | null> {
  if (!isUuid(id)) return null;
  return (await store.list(projectId)).find((p) => p.id === id.toLowerCase()) ?? null;
}

// ---------------------------------------------------------------------------------------------------------------
// Writes

export type AddPourResult = { ok: true; id: string } | { ok: false; kind: 'invalid'; errors: PourError[] } | { ok: false; kind: 'failed'; reason: PourFailure };

/** FR-QLT-04 (design S27.2). @param phaseIds the project's phases (from the session). */
export async function addPour(store: PourStore, projectId: string, phaseIds: string[], input: PourInput, today: string): Promise<AddPourResult> {
  const v = validatePour(input, today, (id) => phaseIds.includes(id));
  if (!v.ok) return { ok: false, kind: 'invalid', errors: v.errors };
  const r = await store.add(projectId, { ...v.value, qtyM3: v.value.qtyM3.toFixed(3) });
  return r.status === 'done' ? { ok: true, id: r.id } : { ok: false, kind: 'failed', reason: r.reason };
}

/** FR-QLT-05: «تمّ» on a curing or formwork reminder, or undoing it. */
export async function markReminder(store: PourStore, projectId: string, id: string, kind: string, done: boolean) {
  if (!isUuid(id) || (kind !== 'curing' && kind !== 'formwork')) return { status: 'failed' as const, reason: 'rejected' as const };
  return store.setDone(projectId, id.toLowerCase(), kind, done);
}

export async function removePour(store: PourStore, projectId: string, id: string) {
  if (!isUuid(id)) return { status: 'failed' as const, reason: 'not_found' as const };
  return store.remove(projectId, id.toLowerCase());
}
