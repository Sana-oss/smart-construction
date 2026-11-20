// Reads for Server Components (pages). Server-only: uses the signed-in user's session cookie (RLS applies).

import { createServerSupabase } from '@/platform/supabase/server';
import { getCashflow, type CashflowView } from '../application/cashflow';
import { getRateLog, type RateLog } from '../application/rates';
import { getBudgetView, type BudgetView, type ProjectBudget } from '../application/budget-plan';
import { supabaseBudgetStore } from '../infra/supabase-budget-store';
import { getExtras, type ExtrasView } from '../application/extras';
import { supabaseExtraStore } from '../infra/supabase-extra-store';
import { supabaseRateStore } from '../infra/supabase-rate-store';
import type { LatestRates } from './ExpenseFields';
import { supabaseCashflowStore } from '../infra/supabase-cashflow-store';
import { supabaseFileStore } from '@/platform/supabase/storage';
import type { ExpenseFilter } from '../domain/expense-filter';
import { findExpense, listExpenses, type ExpenseList, type ExpenseListItem } from '../application/list-expenses';
import { supabaseExpenseReader } from '../infra/supabase-expense-reader';

/**
 * The expenses list of a project (design S13.1), filtered when `filter` is given (S13.2).
 * `today` is the date in Libya ("YYYY-MM-DD").
 */
export async function getExpenseList(projectId: string, today: string, filter?: ExpenseFilter): Promise<ExpenseList> {
  const supabase = await createServerSupabase();
  return listExpenses(supabaseExpenseReader(supabase), projectId, today, supabaseFileStore(supabase), filter);
}

/** One expense of the project, for its edit screen; null when not found (or not visible to this user). */
export async function getExpense(projectId: string, expenseId: string): Promise<ExpenseListItem | null> {
  const supabase = await createServerSupabase();
  return findExpense(supabaseExpenseReader(supabase), projectId, expenseId, supabaseFileStore(supabase));
}

/** Obligations, expected income and the 30-day outlook (design S16.1). `today` is the date in Libya. */
export async function getCashflowView(
  project: { id: string; availableNowLyd: string | null; availableAsOf: string | null },
  today: string,
): Promise<CashflowView> {
  return getCashflow(supabaseCashflowStore(await createServerSupabase()), project, today);
}

/** The reference rates log (3.18). */
export async function getRateLogView(projectId: string): Promise<RateLog> {
  return getRateLog(supabaseRateStore(await createServerSupabase()), projectId);
}

/** The latest rate of each currency, for the expense forms to start with. */
export async function getLatestRates(projectId: string): Promise<LatestRates> {
  const { latest } = await getRateLogView(projectId);
  return Object.fromEntries(Object.entries(latest).map(([code, r]) => [code, { lydPerUnit: r!.lydPerUnit, rateDate: r!.rateDate }])) as LatestRates;
}

/** The budget and its plan per phase (design S15.1, S15.2). `project` comes from the projects module (the page). */
export async function getProjectBudget(project: ProjectBudget): Promise<BudgetView> {
  return getBudgetView(supabaseBudgetStore(await createServerSupabase()), project);
}

/** Extra works and their effect on the contingency (FR-FIN-10). `project` comes from the projects module (the page). */
export async function getExtrasView(project: { id: string; totalBudgetLyd: string; contingencyPct: string }): Promise<ExtrasView> {
  return getExtras(supabaseExtraStore(await createServerSupabase()), project);
}
