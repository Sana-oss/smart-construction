import { isUuid, percentOf, toDb } from '@/shared-kernel';
import { contingencyUse, isExtraStatus, validateExtra, type ContingencyUse, type ExtraError, type ExtraInput, type ExtraStatus } from '../domain/extras';
import type { ExpenseFailure } from './expense-gateway';

// Use cases: extra works and changes (FR-FIN-10, UC-17; 3.16 financial part, slice 2). Run on the server as the
// signed-in user, under RLS. The database audits every change, an approval included (0022).

export interface ExtraRecord {
  id: string;
  title: string;
  /** "12500.000" */
  costLyd: string;
  status: ExtraStatus;
  /** "YYYY-MM-DD" */
  occurredOn: string;
  phaseId: string | null;
  /** The contract the work belongs to; null = none (3.16). */
  contractId: string | null;
  note: string | null;
  createdAt: string;
}

export interface NewExtraRecord {
  projectId: string;
  title: string;
  costLyd: string;
  status: ExtraStatus;
  occurredOn: string | null;
  phaseId: string | null;
  contractId: string | null;
  note: string | null;
}

export type ExtraOutcome = { status: 'done' } | { status: 'failed'; reason: ExpenseFailure };

/** Port. The Supabase adapter is infra/supabase-extra-store.ts; tests use a fake. */
export interface ExtraStore {
  list(projectId: string): Promise<ExtraRecord[]>;
  add(extra: NewExtraRecord): Promise<ExtraOutcome>;
  setStatus(projectId: string, id: string, status: ExtraStatus): Promise<ExtraOutcome>;
  /** Links the work to a contract of the same project, or unlinks it (null). The database checks the project (0022). */
  setContract(projectId: string, id: string, contractId: string | null): Promise<ExtraOutcome>;
  remove(projectId: string, id: string): Promise<ExtraOutcome>;
}

export type AddExtraResult = { ok: true } | { ok: false; kind: 'invalid'; errors: ExtraError[] } | { ok: false; kind: 'failed'; reason: ExpenseFailure };

/** @param today the date in Libya. */
export async function addExtra(store: ExtraStore, command: ExtraInput & { projectId: string }, today: string): Promise<AddExtraResult> {
  if (!isUuid(command.projectId)) return { ok: false, kind: 'failed', reason: 'not_allowed' };
  const valid = validateExtra(command, today);
  if (!valid.ok) return { ok: false, kind: 'invalid', errors: valid.errors };
  const v = valid.value;
  const outcome = await store.add({
    projectId: command.projectId.toLowerCase(),
    title: v.title,
    costLyd: toDb(v.costLyd),
    status: v.status,
    occurredOn: v.occurredOn,
    phaseId: v.phaseId,
    contractId: v.contractId,
    note: v.note,
  });
  return outcome.status === 'done' ? { ok: true } : { ok: false, kind: 'failed', reason: outcome.reason };
}

/** Approve, reject, or set back to proposed. The database records who and when (audit, 0022). */
export async function setExtraStatus(
  store: ExtraStore,
  command: { projectId: string; id: string; status: string },
): Promise<{ ok: true } | { ok: false; reason: ExpenseFailure }> {
  if (!isUuid(command.projectId) || !isUuid(command.id) || !isExtraStatus(command.status)) return { ok: false, reason: 'not_found' };
  const outcome = await store.setStatus(command.projectId.toLowerCase(), command.id.toLowerCase(), command.status);
  return outcome.status === 'done' ? { ok: true } : { ok: false, reason: outcome.reason };
}

/** Link an extra work to a contract, or unlink it (contractId empty). Recorded by the audit trigger (0022). */
export async function linkExtraToContract(
  store: ExtraStore,
  command: { projectId: string; id: string; contractId: string | null },
): Promise<{ ok: true } | { ok: false; reason: ExpenseFailure }> {
  const contract = (command.contractId ?? '').trim().toLowerCase();
  if (!isUuid(command.projectId) || !isUuid(command.id) || (contract !== '' && !isUuid(contract))) return { ok: false, reason: 'not_found' };
  const outcome = await store.setContract(command.projectId.toLowerCase(), command.id.toLowerCase(), contract === '' ? null : contract);
  return outcome.status === 'done' ? { ok: true } : { ok: false, reason: outcome.reason };
}

export async function removeExtra(store: ExtraStore, command: { projectId: string; id: string }): Promise<{ ok: true } | { ok: false; reason: ExpenseFailure }> {
  if (!isUuid(command.projectId) || !isUuid(command.id)) return { ok: false, reason: 'not_found' };
  const outcome = await store.remove(command.projectId.toLowerCase(), command.id.toLowerCase());
  return outcome.status === 'done' ? { ok: true } : { ok: false, reason: outcome.reason };
}

export interface ExtrasView {
  /** Newest first. */
  extras: ExtraRecord[];
  use: ContingencyUse;
}

export async function getExtras(store: ExtraStore, project: { id: string; totalBudgetLyd: string; contingencyPct: string }): Promise<ExtrasView> {
  const extras = (await store.list(project.id)).sort((a, b) =>
    a.occurredOn === b.occurredOn ? b.createdAt.localeCompare(a.createdAt) : a.occurredOn < b.occurredOn ? 1 : -1,
  );
  return {
    extras,
    use: contingencyUse({ total: project.totalBudgetLyd, contingency: percentOf(project.totalBudgetLyd, project.contingencyPct), extras }),
  };
}
