import { isUuid } from '@/shared-kernel';
import { latestRates, sortRates, validateRate, type Currency, type RateField, type RateInput, type RateLogErrorCode, type RateRecord } from '../domain/currency';
import type { ExpenseFailure } from './expense-gateway';

// Use cases: the owner's log of reference exchange rates (3.18; owner's decision of 20 Nov 2026). Runs on the server as
// the signed-in user, under RLS. The database audits every change and deletion (0020). A rate here never changes an
// expense already recorded: each expense keeps its own rate.

export interface NewRateRecord {
  projectId: string;
  currency: Currency;
  lydPerUnit: string;
  rateDate: string | null;
  note: string | null;
}

export type RateOutcome = { status: 'done' } | { status: 'failed'; reason: ExpenseFailure };

/** Port. The Supabase adapter is infra/supabase-rate-store.ts; tests use a fake. */
export interface RateStore {
  /** All the project's rates. ALL of them, or throw. */
  list(projectId: string): Promise<RateRecord[]>;
  add(rate: NewRateRecord): Promise<RateOutcome>;
  remove(projectId: string, id: string): Promise<RateOutcome>;
}

export type AddRateResult =
  | { ok: true }
  | { ok: false; kind: 'invalid'; errors: { field: RateField; code: RateLogErrorCode }[] }
  | { ok: false; kind: 'failed'; reason: ExpenseFailure };

/** @param today the date in Libya. */
export async function addRate(store: RateStore, command: RateInput & { projectId: string }, today: string): Promise<AddRateResult> {
  if (!isUuid(command.projectId)) return { ok: false, kind: 'failed', reason: 'not_allowed' };
  const valid = validateRate(command, today);
  if (!valid.ok) return { ok: false, kind: 'invalid', errors: valid.errors };
  const outcome = await store.add({ projectId: command.projectId.toLowerCase(), ...valid.value });
  return outcome.status === 'done' ? { ok: true } : { ok: false, kind: 'failed', reason: outcome.reason };
}

export async function removeRate(store: RateStore, command: { projectId: string; id: string }): Promise<{ ok: true } | { ok: false; reason: ExpenseFailure }> {
  if (!isUuid(command.projectId) || !isUuid(command.id)) return { ok: false, reason: 'not_found' };
  const outcome = await store.remove(command.projectId.toLowerCase(), command.id.toLowerCase());
  return outcome.status === 'done' ? { ok: true } : { ok: false, reason: outcome.reason };
}

export interface RateLog {
  /** Newest first. */
  rates: RateRecord[];
  /** The latest of each currency: what the expense form starts with. */
  latest: Partial<Record<Currency, RateRecord>>;
}

export async function getRateLog(store: RateStore, projectId: string): Promise<RateLog> {
  const records = await store.list(projectId);
  return { rates: sortRates(records), latest: latestRates(records) };
}
