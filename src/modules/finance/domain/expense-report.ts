import { addMoney, money, type Money, type MoneyInput } from '@/shared-kernel';
import { phaseUse, type Allocations } from './allocation';
import { EXPENSE_TYPES, type ExpenseType } from './expense';

// The expenses report (FR-FIN-05; owner's decisions of 21 Nov 2026, change register): the expenses of a period summed
// by phase and by expense type, and, for «كل الفترات» only, each phase's spending against its allocation.
// Pure: no React, no database. The screen only displays these numbers (rule R5).
//
// Acceptance criterion of FR-FIN-05: the report's total matches the expenses. So every expense lands in exactly one
// row and one type: expenses without a phase (or with a phase this project no longer lists) go to the «بلا مرحلة»
// row, and expenses without a type (recorded before migration 0009) go to «غير محدد».

/** The report's types: the three expense types, then «غير محدد» for old expenses without one. */
export const REPORT_TYPES = [...EXPENSE_TYPES, 'unspecified'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export type TypeTotals = Record<ReportType, Money>;

/** One expense as the report needs it. */
export interface ReportExpense {
  phaseId: string | null;
  expenseType: ExpenseType | null;
  amountLyd: MoneyInput;
}

export interface PhasePlan {
  /** Null = no allocation for this phase. */
  allocated: Money | null;
  /** Whole percent of the allocation spent, rounded down; null without an allocation (or a zero one). */
  usedPct: number | null;
  /** FR-FIN-11: spent > allocated × (1 + D5). */
  over: boolean;
}

export interface ReportRow {
  /** Null = the «بلا مرحلة» row. */
  phaseId: string | null;
  spent: Money;
  count: number;
  byType: TypeTotals;
  /** Planned against actual; null when the report has no plan (a period other than «كل الفترات») or for «بلا مرحلة». */
  plan: PhasePlan | null;
}

export interface ExpenseReport {
  /** Every phase in plan order (also those with nothing spent), then «بلا مرحلة» only when it has expenses. */
  rows: ReportRow[];
  byType: TypeTotals;
  /** The sum of ALL the expenses given: equal to the sum of the rows and to the sum of the types. */
  total: Money;
  count: number;
  /** True when the rows carry the plan (allocations were given). */
  withPlan: boolean;
}

const zeroTypes = (): TypeTotals =>
  Object.fromEntries(REPORT_TYPES.map((t) => [t, money('0')])) as TypeTotals;

/**
 * @param phases the project's phases, in plan order.
 * @param expenses ALL the expenses of the period (the adapter refuses a partial list).
 * @param allocations each phase's allocation, or null for no planned-against-actual (decision: «كل الفترات» only,
 *   because an allocation covers the whole project, not a month).
 */
export function expenseReport(input: {
  phases: readonly { id: string }[];
  expenses: readonly ReportExpense[];
  allocations: Allocations | null;
}): ExpenseReport {
  const known = new Set(input.phases.map((p) => p.id));
  const acc = new Map<string | null, { spent: Money; count: number; byType: TypeTotals }>();
  const rowOf = (key: string | null) => {
    let r = acc.get(key);
    if (!r) {
      r = { spent: money('0'), count: 0, byType: zeroTypes() };
      acc.set(key, r);
    }
    return r;
  };
  const byType = zeroTypes();
  for (const e of input.expenses) {
    const key = e.phaseId !== null && known.has(e.phaseId) ? e.phaseId : null;
    const type: ReportType = e.expenseType ?? 'unspecified';
    const r = rowOf(key);
    r.spent = addMoney(r.spent, e.amountLyd);
    r.count += 1;
    r.byType[type] = addMoney(r.byType[type], e.amountLyd);
    byType[type] = addMoney(byType[type], e.amountLyd);
  }

  const rows: ReportRow[] = input.phases.map((p) => {
    const r = acc.get(p.id) ?? { spent: money('0'), count: 0, byType: zeroTypes() };
    const allocated = input.allocations ? (input.allocations.get(p.id) ?? null) : null;
    return {
      phaseId: p.id,
      ...r,
      plan: input.allocations ? { allocated, ...phaseUse(allocated, r.spent) } : null,
    };
  });
  const none = acc.get(null);
  if (none) rows.push({ phaseId: null, ...none, plan: null });

  return {
    rows,
    byType,
    total: addMoney('0', ...input.expenses.map((e) => e.amountLyd)),
    count: input.expenses.length,
    withPlan: input.allocations !== null,
  };
}
