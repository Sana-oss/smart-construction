import { addMoney, isUuid, money, readMoneyInput, subMoney, type Money, type MoneyInput, type MoneyInputError } from '@/shared-kernel';

// The budget plan: an allocation per phase (design S15.2 «توزيع الميزانية»), and FR-FIN-11's warning when a phase's
// expenses pass its allocation by more than the deviation threshold (decision D5, 10% for now; owner's decisions of
// 20 Nov 2026, change register). Pure: no React, no database. Money is Decimal.
// A warning, never a block (decision D2): the owner may spend over the plan; the app shows it.

/** D5: the deviation allowed above a phase's allocation before warning. Temporary, in the master reference (16.3). */
export const DEVIATION_PCT = '10';

export type AllocationErrorCode = MoneyInputError | 'unknown_choice';
export interface AllocationError {
  phaseId: string;
  code: AllocationErrorCode;
}

/** phase id -> what the owner typed. Empty = no allocation for that phase. */
export type AllocationInput = Record<string, string | null | undefined>;

/** phase id -> amount (null = no allocation). Only the project's phases. */
export type Allocations = Map<string, Money | null>;

export function validateAllocations(
  input: AllocationInput,
  phaseIds: readonly string[],
): { ok: true; value: Allocations } | { ok: false; errors: AllocationError[] } {
  const errors: AllocationError[] = [];
  const value: Allocations = new Map();
  const known = new Set(phaseIds.map((p) => p.toLowerCase()));
  for (const [rawId, raw] of Object.entries(input)) {
    const id = rawId.trim().toLowerCase();
    if (!isUuid(id) || !known.has(id)) {
      errors.push({ phaseId: rawId, code: 'unknown_choice' });
      continue;
    }
    if ((raw ?? '').trim() === '') {
      value.set(id, null);
      continue;
    }
    const r = readMoneyInput(raw, { allowZero: true });
    if (r.ok) value.set(id, r.value);
    else errors.push({ phaseId: id, code: r.code });
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value };
}

export interface PhaseBudgetRow {
  phaseId: string;
  allocated: Money | null;
  /** Expenses recorded on this phase. */
  spent: Money;
  /** Whole percent of the allocation spent, rounded down; null without an allocation (or a zero one). */
  usedPct: number | null;
  /** FR-FIN-11: spent > allocated × (1 + D5). */
  over: boolean;
}

export interface BudgetPlan {
  rows: PhaseBudgetRow[];
  /** Expenses recorded without a phase. */
  unassigned: Money;
  allocatedTotal: Money;
  /** What the phases can share: the total budget minus the contingency (S15.2 shows the contingency as its own row). */
  forPhases: Money;
  /** The allocations add up to more than forPhases: a warning (D2), not a refusal. */
  overAllocated: boolean;
  overPhases: number;
}

/**
 * @param phases in plan order.
 * @param spentByPhase expenses recorded in the app, summed by phase (null key = no phase).
 */
export function budgetPlan(input: {
  phases: readonly { id: string }[];
  allocations: Allocations;
  spentByPhase: ReadonlyMap<string | null, MoneyInput>;
  total: MoneyInput;
  contingency: MoneyInput;
}): BudgetPlan {
  const limit = money(DEVIATION_PCT).plus(100).dividedBy(100);
  const rows = input.phases.map((p): PhaseBudgetRow => {
    const allocated = input.allocations.get(p.id) ?? null;
    const spent = money(input.spentByPhase.get(p.id) ?? '0');
    const planned = allocated !== null && allocated.gt(0);
    return {
      phaseId: p.id,
      allocated,
      spent,
      usedPct: planned ? spent.times(100).dividedBy(allocated).floor().toNumber() : null,
      over: planned ? spent.gt(allocated.times(limit)) : false,
    };
  });
  const allocatedTotal = addMoney('0', ...rows.map((r) => r.allocated ?? '0'));
  const forPhases = subMoney(input.total, input.contingency);
  return {
    rows,
    unassigned: money(input.spentByPhase.get(null) ?? '0'),
    allocatedTotal,
    forPhases,
    overAllocated: allocatedTotal.gt(forPhases),
    overPhases: rows.filter((r) => r.over).length,
  };
}

/** Expenses summed by phase (null = no phase), in the domain so the screens never add money themselves (rule R5). */
export function sumByPhase(rows: readonly { phaseId: string | null; amountLyd: MoneyInput }[]): Map<string | null, Money> {
  const out = new Map<string | null, Money>();
  for (const r of rows) out.set(r.phaseId, addMoney(out.get(r.phaseId) ?? '0', r.amountLyd));
  return out;
}
