// Reads for Server Components (pages). Server-only: uses the signed-in user's session cookie (RLS applies).

import { createServerSupabase } from '@/platform/supabase/server';
import { getCashflow, type CashflowView } from '../application/cashflow';
import { getRateLog, type RateLog } from '../application/rates';
import { getBudgetView, type BudgetView, type ProjectBudget } from '../application/budget-plan';
import { supabaseBudgetStore } from '../infra/supabase-budget-store';
import { getContract, getContracts, type ContractDetail, type ContractsView } from '../application/contracts';
import { getExtras, type ExtrasView } from '../application/extras';
import { contractExtras, type ContractExtras } from '../domain/extras';
import { supabaseContractStore } from '../infra/supabase-contract-store';
import { supabaseExtraStore } from '../infra/supabase-extra-store';
import { supabaseRateStore } from '../infra/supabase-rate-store';
import type { LatestRates } from './ExpenseFields';
import { supabaseCashflowStore } from '../infra/supabase-cashflow-store';
import { supabaseFileStore } from '@/platform/supabase/storage';
import type { ExpenseFilter } from '../domain/expense-filter';
import { findExpense, listExpenses, type ExpenseList, type ExpenseListItem } from '../application/list-expenses';
import { supabaseExpenseReader } from '../infra/supabase-expense-reader';
import { getExpenseReport, type ExpenseReportView } from '../application/expense-report';
import { supabaseReportStore } from '../infra/supabase-report-store';
import type { ExpensePeriod } from '../domain/expense-filter';

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

/** Every contract of the project with its figures (design S17.1). */
export async function getContractsView(projectId: string): Promise<ContractsView> {
  return getContracts(supabaseContractStore(await createServerSupabase()), projectId);
}

/** One contract with its payment schedule (design S17.2); null when not found (or not visible to this user). */
export async function getContractDetail(projectId: string, contractId: string): Promise<ContractDetail | null> {
  return getContract(supabaseContractStore(await createServerSupabase()), projectId, contractId);
}

/** The expenses report (FR-FIN-05). `project` (id, phases in plan order) comes from the projects module (the page). */
export async function getExpenseReportView(
  project: { id: string; phases: readonly { id: string }[] },
  period: ExpensePeriod,
  today: string,
): Promise<ExpenseReportView> {
  return getExpenseReport(supabaseReportStore(await createServerSupabase()), project, period, today);
}

/** The extra works linked to one contract: shown on its page, never part of its numbers (3.16 deepening). */
export async function getContractExtras(projectId: string, contractId: string): Promise<ContractExtras> {
  const all = await supabaseExtraStore(await createServerSupabase()).list(projectId);
  return contractExtras(all.filter((e) => e.contractId === contractId.toLowerCase()));
}
