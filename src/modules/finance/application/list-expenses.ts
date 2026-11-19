import type { FileStore } from '@/platform/supabase/storage';
import type { ExpenseType } from '../domain/expense';
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
  /** Short-lived link to the receipt photo (NFR-SEC-03), set by listExpenses; null without a receipt. */
  receiptUrl?: string | null;
}

/** How long a link to a receipt photo works (same as site photos). */
export const RECEIPT_URL_TTL_SECONDS = 10 * 60;

/** Port: what this use case needs from storage. The Supabase adapter is infra/supabase-expense-reader.ts. */
export interface ExpenseReader {
  /** Newest first (date paid, then time recorded). `totalCount` = all the project's expenses, not only these. */
  recentExpenses(projectId: string, limit: number): Promise<{ items: ExpenseListItem[]; totalCount: number }>;
  /**
   * Amounts of the expenses paid in [from, to). Must return ALL of them, or throw: a partial list would give a
   * wrong total without any sign of it.
   */
  amountsPaidBetween(projectId: string, range: MonthRange): Promise<string[]>;
}

/**
 * How many expenses the list shows. Supabase returns at most 1,000 rows per request, and a phone does not need
 * hundreds of rows on one screen. When there are more, the screen says so; paging comes with the filter (S13.2).
 */
export const EXPENSE_LIST_LIMIT = 50;

export interface ExpenseList {
  items: ExpenseListItem[];
  /** All the project's expenses. More than items.length means older ones are not shown. */
  totalCount: number;
  month: MonthRange & MonthSummary;
}

/** @param store when given, each shown expense with a receipt photo gets a short-lived link to it. */
export async function listExpenses(reader: ExpenseReader, projectId: string, today: string, store?: FileStore): Promise<ExpenseList> {
  const range = monthOf(today);
  const [recent, monthAmounts] = await Promise.all([
    reader.recentExpenses(projectId, EXPENSE_LIST_LIMIT),
    reader.amountsPaidBetween(projectId, range),
  ]);
  const paths = recent.items.map((i) => i.receiptPath).filter((p): p is string => p !== null);
  const urls = store && paths.length > 0 ? await store.signedUrls(paths, RECEIPT_URL_TTL_SECONDS) : new Map<string, string>();
  const items = recent.items.map((i) => ({ ...i, receiptUrl: i.receiptPath ? (urls.get(i.receiptPath) ?? null) : null }));
  return { items, totalCount: recent.totalCount, month: { ...range, ...monthSummary(monthAmounts) } };
}
