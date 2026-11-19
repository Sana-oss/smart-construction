import { isUuid, toDb, type Money } from '@/shared-kernel';
import {
  cashflowOutlook,
  currentLiquidity,
  validateMovement,
  type CashflowOutlook,
  type Liquidity,
  type MovementError,
  type MovementInput,
  type MovementKind,
} from '../domain/cashflow';
import type { ExpenseFailure } from './expense-gateway';

// Use cases: obligations and expected income (design S16.1, S16.2; FR-FIN-06, FR-FIN-07), and the cash outlook of
// the next 30 days (the timing rule of FR-DEC-01). Run on the server as the signed-in user, under RLS.

/** One row of S16.1. Money stays a decimal string ("15000.000"). */
export interface MovementItem {
  id: string;
  kind: MovementKind;
  title: string;
  amountLyd: string;
  /** "YYYY-MM-DD": expected (income) or due (obligation). */
  date: string;
  party: string;
}

export interface NewMovementRecord {
  projectId: string;
  kind: MovementKind;
  title: string;
  amountLyd: string;
  date: string;
  party: string;
}

export type MovementOutcome = { status: 'done' } | { status: 'failed'; reason: ExpenseFailure };

/** Port. The Supabase adapter is infra/supabase-cashflow-store.ts; tests use a fake. */
export interface CashflowStore {
  /** Both kinds, any date. */
  movements(projectId: string): Promise<MovementItem[]>;
  /** Expenses paid on or after `since` (for «السيولة الحالية»). ALL of them, or throw. */
  expensesPaidSince(projectId: string, since: string): Promise<{ amountLyd: string; paidOn: string }[]>;
  add(movement: NewMovementRecord): Promise<MovementOutcome>;
  /** The database audits the deletion (0017). 0 rows = not found (or not allowed: RLS hides both). */
  remove(projectId: string, kind: MovementKind, id: string): Promise<MovementOutcome>;
}

export type AddMovementResult =
  | { ok: true }
  | { ok: false; kind: 'invalid'; errors: MovementError[] }
  | { ok: false; kind: 'failed'; reason: ExpenseFailure };

export async function addMovement(store: CashflowStore, command: MovementInput & { projectId: string }): Promise<AddMovementResult> {
  if (!isUuid(command.projectId)) return { ok: false, kind: 'failed', reason: 'not_allowed' };
  const valid = validateMovement(command);
  if (!valid.ok) return { ok: false, kind: 'invalid', errors: valid.errors };
  const { kind, title, date, party } = valid.value;
  const outcome = await store.add({
    projectId: command.projectId.toLowerCase(),
    kind,
    title,
    amountLyd: toDb(valid.value.amountLyd),
    date,
    party,
  });
  return outcome.status === 'done' ? { ok: true } : { ok: false, kind: 'failed', reason: outcome.reason };
}

export async function removeMovement(
  store: CashflowStore,
  command: { projectId: string; kind: string; id: string },
): Promise<{ ok: true } | { ok: false; reason: ExpenseFailure }> {
  if (!isUuid(command.projectId) || !isUuid(command.id) || (command.kind !== 'income' && command.kind !== 'obligation')) {
    return { ok: false, reason: 'not_found' };
  }
  const outcome = await store.remove(command.projectId.toLowerCase(), command.kind, command.id.toLowerCase());
  return outcome.status === 'done' ? { ok: true } : { ok: false, reason: outcome.reason };
}

export interface CashflowView {
  /** Sorted by date, then obligations first (the order the outlook pays them). */
  items: (MovementItem & { overdue: boolean })[];
  /** Null when the owner never gave «المتاح» (wizard): shown as missing (FR-DEC-03). */
  liquidity: Liquidity | null;
  /** Null without liquidity: no balance can be honest without a starting figure. */
  outlook: CashflowOutlook | null;
  /** Totals of the next 30 days, shown even without liquidity. */
  window: { until: string; income: Money; obligations: Money };
}

/**
 * S16.1. `availableNow` / `availableAsOf` come from the project (the projects module, through the page).
 * @param today the date in Libya, "YYYY-MM-DD".
 */
export async function getCashflow(
  store: CashflowStore,
  project: { id: string; availableNowLyd: string | null; availableAsOf: string | null },
  today: string,
): Promise<CashflowView> {
  const [movements, spent] = await Promise.all([
    store.movements(project.id),
    project.availableAsOf ? store.expensesPaidSince(project.id, project.availableAsOf) : Promise.resolve([]),
  ]);
  const items = [...movements]
    .sort((a, b) => (a.date === b.date ? (a.kind === b.kind ? 0 : a.kind === 'obligation' ? -1 : 1) : a.date < b.date ? -1 : 1))
    .map((m) => ({ ...m, overdue: m.kind === 'obligation' && m.date < today }));
  const liquidity = currentLiquidity(project.availableNowLyd, project.availableAsOf, spent);
  // The window's totals do not depend on the starting figure; the balance and the shortfall do.
  const plain = cashflowOutlook('0', movements, today);
  return {
    items,
    liquidity,
    outlook: liquidity ? cashflowOutlook(liquidity.amount, movements, today) : null,
    window: { until: plain.until, income: plain.income, obligations: plain.obligations },
  };
}
