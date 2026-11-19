import { isUuid } from '@/shared-kernel';
import { EXPENSE_TYPES, type ExpenseType } from './expense';
import { monthOf, type MonthRange } from './expense-list';

// Filtering the expenses list (design S13.2 «تصفية المصروفات»; groundwork for FR-FIN-05: expenses by phase, type and
// period, whose total must match the expenses). Pure: the filter arrives as the address's text (?q=&period=...),
// and every value is checked here; anything unknown is dropped, never passed to the database as it is.

/**
 * The «الفترة» choices. The design shows only «هذا الشهر» as an example; this list is a project decision of
 * 19 Nov 2026 (change register), easy to change.
 */
export const EXPENSE_PERIODS = ['all', 'this_month', 'last_month', 'last_3_months', 'this_year'] as const;
export type ExpensePeriod = (typeof EXPENSE_PERIODS)[number];

/** Longest search text kept (characters as a person counts them). */
export const EXPENSE_SEARCH_MAX = 40;

export interface ExpenseFilter {
  /** Letters, digits and single spaces only, or '' for no search. */
  search: string;
  period: ExpensePeriod;
  phaseId: string | null;
  expenseType: ExpenseType | null;
}

export const NO_FILTER: ExpenseFilter = { search: '', period: 'all', phaseId: null, expenseType: null };

/** The address's values, as Next.js gives them (a value may repeat, so it may be a list). */
export type ExpenseFilterParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

/**
 * Search text -> only letters, digits and spaces. This removes the characters that mean something to the database's
 * pattern matching (% _ * , ( ) and quotes), so the search is always a plain "contains this text".
 */
export function cleanSearch(raw: string): string {
  const kept = raw.normalize('NFC').replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  return [...kept].slice(0, EXPENSE_SEARCH_MAX).join('').trim();
}

export function parseExpenseFilter(params: ExpenseFilterParams): ExpenseFilter {
  const period = first(params.period);
  const phase = first(params.phase).trim().toLowerCase();
  const type = first(params.type);
  return {
    search: cleanSearch(first(params.q)),
    period: (EXPENSE_PERIODS as readonly string[]).includes(period) ? (period as ExpensePeriod) : 'all',
    phaseId: isUuid(phase) ? phase : null,
    expenseType: (EXPENSE_TYPES as readonly string[]).includes(type) ? (type as ExpenseType) : null,
  };
}

export function isFiltered(f: ExpenseFilter): boolean {
  return f.search !== '' || f.period !== 'all' || f.phaseId !== null || f.expenseType !== null;
}

/** The filter as the address's query (only what is set), e.g. "q=حديد&type=materials". Empty for no filter. */
export function filterQuery(f: ExpenseFilter): string {
  const p = new URLSearchParams();
  if (f.search) p.set('q', f.search);
  if (f.period !== 'all') p.set('period', f.period);
  if (f.phaseId) p.set('phase', f.phaseId);
  if (f.expenseType) p.set('type', f.expenseType);
  return p.toString();
}

const shiftMonths = (range: MonthRange, months: number): string => {
  const y = Number(range.from.slice(0, 4));
  const m = Number(range.from.slice(5, 7)) - 1 + months; // 0-based, may be negative
  const year = y + Math.floor(m / 12);
  const month = ((m % 12) + 12) % 12;
  return `${year}-${String(month + 1).padStart(2, '0')}-01`;
};

/**
 * The period as a half-open range of dates (from <= paid_on < to), or null for «كل الفترات». Months are the
 * owner's months in Libya: `today` is todayInTripoli(). "Last 3 months" = this month and the two before it.
 */
export function periodRange(period: ExpensePeriod, today: string): MonthRange | null {
  const month = monthOf(today);
  switch (period) {
    case 'all':
      return null;
    case 'this_month':
      return month;
    case 'last_month':
      return { from: shiftMonths(month, -1), to: month.from };
    case 'last_3_months':
      return { from: shiftMonths(month, -2), to: month.to };
    case 'this_year':
      return { from: `${today.slice(0, 4)}-01-01`, to: `${Number(today.slice(0, 4)) + 1}-01-01` };
  }
}
