import { addMoney, isUuid, toDb } from '@/shared-kernel';
import { budgetPlan, sumByPhase, validateAllocations, type AllocationError, type AllocationInput, type Allocations, type BudgetPlan } from '../domain/allocation';
import { budgetSummary, totalSpent, type BudgetSummary } from '../domain/budget';
import type { ExpenseFailure } from './expense-gateway';

// Use cases: the budget plan (design S15.1 «ميزانية المشروع», S15.2 «توزيع الميزانية»; FR-FIN-11; 3.16 financial part,
// slice 1). Run on the server as the signed-in user, under RLS. The database audits every change (0021).

/** Port. The Supabase adapter is infra/supabase-budget-store.ts; tests use a fake. */
export interface BudgetStore {
  /** phase id -> allocation (decimal string). */
  allocations(projectId: string): Promise<Map<string, string>>;
  /** Every expense's phase and amount. ALL of them, or throw (a partial list would give a wrong per-phase total). */
  expensesByPhase(projectId: string): Promise<{ phaseId: string | null; amountLyd: string }[]>;
  /** Sets the given allocations (amount) and removes the others (null), in one request per kind. */
  saveAllocations(projectId: string, entries: { phaseId: string; amountLyd: string | null }[]): Promise<{ status: 'done' } | { status: 'failed'; reason: ExpenseFailure }>;
}

export interface ProjectBudget {
  id: string;
  totalBudgetLyd: string;
  spentBeforeLyd: string;
  contingencyPct: string;
  phases: readonly { id: string }[];
}

export interface BudgetView {
  /** S15.1: total, spent (before the app + recorded), remaining, contingency. */
  summary: BudgetSummary;
  /** S15.2: the allocation and spending of each phase, and the warnings. */
  plan: BudgetPlan;
}

export async function getBudgetView(store: BudgetStore, project: ProjectBudget): Promise<BudgetView> {
  const [stored, expenses] = await Promise.all([store.allocations(project.id), store.expensesByPhase(project.id)]);
  const byPhase = sumByPhase(expenses);
  // Spent = before the app + every recorded expense (decision 2 of 14 Nov), the same definition as the dashboard.
  const recorded = addMoney('0', ...expenses.map((e) => e.amountLyd));
  const summary = budgetSummary(project.totalBudgetLyd, totalSpent(project.spentBeforeLyd, recorded), project.contingencyPct);
  const allocations: Allocations = new Map(project.phases.map((p) => [p.id, null]));
  const parsed = validateAllocations(Object.fromEntries(stored), project.phases.map((p) => p.id));
  if (parsed.ok) for (const [id, amount] of parsed.value) allocations.set(id, amount);
  return {
    summary,
    plan: budgetPlan({ phases: project.phases, allocations, spentByPhase: byPhase, total: project.totalBudgetLyd, contingency: summary.contingency }),
  };
}

export type SaveAllocationsResult =
  | { ok: true }
  | { ok: false; kind: 'invalid'; errors: AllocationError[] }
  | { ok: false; kind: 'failed'; reason: ExpenseFailure };

export async function saveAllocations(
  store: BudgetStore,
  command: { projectId: string; allocations: AllocationInput },
  phaseIds: readonly string[],
): Promise<SaveAllocationsResult> {
  if (!isUuid(command.projectId)) return { ok: false, kind: 'failed', reason: 'not_allowed' };
  const valid = validateAllocations(command.allocations, phaseIds);
  if (!valid.ok) return { ok: false, kind: 'invalid', errors: valid.errors };
  const entries = [...valid.value].map(([phaseId, amount]) => ({ phaseId, amountLyd: amount === null ? null : toDb(amount) }));
  const outcome = await store.saveAllocations(command.projectId.toLowerCase(), entries);
  return outcome.status === 'done' ? { ok: true } : { ok: false, kind: 'failed', reason: outcome.reason };
}
