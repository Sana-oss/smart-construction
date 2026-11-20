import { isUuid } from '@/shared-kernel';
import type { FileStore } from '@/platform/supabase/storage';
import type { ForeignRecord } from '../domain/currency';
import type { ExpenseType } from '../domain/expense';
import { isFiltered, NO_FILTER, periodRange, type ExpenseFilter } from '../domain/expense-filter';
import { monthOf, monthSummary, type MonthRange, type MonthSummary } from '../domain/expense-list';

// Use case: the project's expenses list (design S13.1, empty state S13.3). Runs on the server, as the signed-in
// user: the reader goes through RLS, so a stranger gets nothing.

/** One expense as the list shows it. Money stays a decimal string ("12000.750"), never a JS number. */
export interface ExpenseListItem {
  id: string;
  /** Empty for expenses recorded before the design fields existed (migration 0009). */
  title: string;
  amountLyd: string;
  /** Null for expenses recorded before migration 0009. */
  expenseType: ExpenseType | null;
  phaseId: string | null;
  payee: string | null;
  /** "YYYY-MM-DD" */
  paidOn: string;
  /** Stored receipt photo (UC-07), or null. */
  receiptPath: string | null;
  /** Paid in a foreign currency (3.18), or null. */
  foreign: ForeignRecord | null;
  /** Short-lived link to the receipt photo (NFR-SEC-03), set by listExpenses; null without a receipt. */
  receiptUrl?: string | null;
}

/** How long a link to a receipt photo works (same as site photos). */
export const RECEIPT_URL_TTL_SECONDS = 10 * 60;

/**
 * Which expenses to read (design S13.2), already checked by the domain (parseExpenseFilter): the search holds only
 * letters, digits and spaces. null / '' = no condition.
 */
export interface ExpenseCriteria {
  range: MonthRange | null;
  phaseId: string | null;
  expenseType: ExpenseType | null;
  search: string;
}

const ALL: ExpenseCriteria = { range: null, phaseId: null, expenseType: null, search: '' };

/** Port: what this use case needs from storage. The Supabase adapter is infra/supabase-expense-reader.ts. */
export interface ExpenseReader {
  /**
   * Newest first (date paid, then time recorded), only those matching `criteria`.
   * `totalCount` = ALL the matching expenses, not only these.
   */
  recentExpenses(
    projectId: string,
    limit: number,
    criteria: ExpenseCriteria,
  ): Promise<{ items: ExpenseListItem[]; totalCount: number }>;
  /** One expense of the project, or null when it is not there (or not visible to this user). */
  expenseById(projectId: string, expenseId: string): Promise<ExpenseListItem | null>;
  /**
   * Amounts of the expenses matching `criteria`. Must return ALL of them, or throw: a partial list would give a
   * wrong total without any sign of it (FR-FIN-05: the total must match the expenses).
   */
  amountsMatching(projectId: string, criteria: ExpenseCriteria): Promise<string[]>;
}

/**
 * How many expenses the list shows. Supabase returns at most 1,000 rows per request, and a phone does not need
 * hundreds of rows on one screen. When there are more, the screen says so; paging comes with the filter (S13.2).
 */
export const EXPENSE_LIST_LIMIT = 50;

export interface ExpenseList {
  items: ExpenseListItem[];
  /** All the matching expenses (all of them without a filter). More than items.length = older ones not shown. */
  totalCount: number;
  month: MonthRange & MonthSummary;
  /** The filter in use (design S13.2); NO_FILTER for the plain list. */
  filter: ExpenseFilter;
  /** With a filter: the total and number of ALL matching expenses (the summary card shows these). Null without. */
  results: MonthSummary | null;
}

/**
 * @param store when given, each shown expense with a receipt photo gets a short-lived link to it.
 * @param filter design S13.2; the period becomes dates here, with the months of `today` in Libya.
 */
export async function listExpenses(
  reader: ExpenseReader,
  projectId: string,
  today: string,
  store?: FileStore,
  filter: ExpenseFilter = NO_FILTER,
): Promise<ExpenseList> {
  const range = monthOf(today);
  const filtered = isFiltered(filter);
  const criteria: ExpenseCriteria = filtered
    ? { range: periodRange(filter.period, today), phaseId: filter.phaseId, expenseType: filter.expenseType, search: filter.search }
    : ALL;
  const [recent, monthAmounts, matchingAmounts] = await Promise.all([
    reader.recentExpenses(projectId, EXPENSE_LIST_LIMIT, criteria),
    reader.amountsMatching(projectId, { ...ALL, range }),
    filtered ? reader.amountsMatching(projectId, criteria) : Promise.resolve(null),
  ]);
  const paths = recent.items.map((i) => i.receiptPath).filter((p): p is string => p !== null);
  const urls = store && paths.length > 0 ? await store.signedUrls(paths, RECEIPT_URL_TTL_SECONDS) : new Map<string, string>();
  const items = recent.items.map((i) => ({ ...i, receiptUrl: i.receiptPath ? (urls.get(i.receiptPath) ?? null) : null }));
  return {
    items,
    totalCount: recent.totalCount,
    month: { ...range, ...monthSummary(monthAmounts) },
    filter,
    results: matchingAmounts ? monthSummary(matchingAmounts) : null,
  };
}

/**
 * One expense, for its edit screen (decision of 19 Nov 2026). Null for an id that is not an id, or an expense that
 * is not in this project or not visible to this user: the page then answers "not found" in every case.
 */
export async function findExpense(
  reader: ExpenseReader,
  projectId: string,
  expenseId: string,
  store?: FileStore,
): Promise<ExpenseListItem | null> {
  if (!isUuid(projectId) || !isUuid(expenseId)) return null;
  const item = await reader.expenseById(projectId.toLowerCase(), expenseId.toLowerCase());
  if (!item) return null;
  const urls = store && item.receiptPath ? await store.signedUrls([item.receiptPath], RECEIPT_URL_TTL_SECONDS) : new Map<string, string>();
  return { ...item, receiptUrl: item.receiptPath ? (urls.get(item.receiptPath) ?? null) : null };
}
