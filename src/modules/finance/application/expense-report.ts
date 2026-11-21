import { validateAllocations, type Allocations } from '../domain/allocation';
import type { ExpenseType } from '../domain/expense';
import { periodRange, type ExpensePeriod } from '../domain/expense-filter';
import type { MonthRange } from '../domain/expense-list';
import { expenseReport, type ExpenseReport } from '../domain/expense-report';

// Use case: the expenses report (FR-FIN-05; owner's decisions of 21 Nov 2026). Runs on the server as the signed-in user,
// under RLS. Planned against actual only for «كل الفترات»: an allocation covers the whole project, and the app does not
// split it over months on its own.

/** Port. The Supabase adapter is infra/supabase-report-store.ts; tests use a fake. */
export interface ExpenseReportStore {
  /**
   * The phase, type and amount of every expense paid in `range` (null = all). ALL of them, or throw: a partial list
   * would give a wrong total without any sign of it (FR-FIN-05).
   */
  expensesIn(
    projectId: string,
    range: MonthRange | null,
  ): Promise<{ phaseId: string | null; expenseType: ExpenseType | null; amountLyd: string }[]>;
  /** phase id -> allocation (decimal string). */
  allocations(projectId: string): Promise<Map<string, string>>;
}

export interface ExpenseReportView {
  period: ExpensePeriod;
  /** The dates the period covers (from <= paid_on < to), or null for «كل الفترات». */
  range: MonthRange | null;
  report: ExpenseReport;
}

/**
 * @param project its id and phases (in plan order) come from the projects module, through the page.
 * @param today the date in Libya ("YYYY-MM-DD"), so «هذا الشهر» is the owner's month.
 */
export async function getExpenseReport(
  store: ExpenseReportStore,
  project: { id: string; phases: readonly { id: string }[] },
  period: ExpensePeriod,
  today: string,
): Promise<ExpenseReportView> {
  const range = periodRange(period, today);
  const withPlan = period === 'all';
  const [expenses, stored] = await Promise.all([
    store.expensesIn(project.id, range),
    withPlan ? store.allocations(project.id) : Promise.resolve(null),
  ]);
  let allocations: Allocations | null = null;
  if (stored) {
    allocations = new Map(project.phases.map((p) => [p.id, null]));
    const parsed = validateAllocations(Object.fromEntries(stored), project.phases.map((p) => p.id));
    if (parsed.ok) for (const [id, amount] of parsed.value) allocations.set(id, amount);
  }
  return { period, range, report: expenseReport({ phases: project.phases, expenses, allocations }) };
}
