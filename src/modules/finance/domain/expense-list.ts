import { addMoney, isIsoDate, type Money, type MoneyInput } from '@/shared-kernel';

// Expenses list (design S13.1 «المصروفات»): the numbers of its summary card. Pure: no React, no database.
// The UI only displays these numbers (rule R5).

/** A calendar month as a half-open range of dates: from <= paid_on < to. Both "YYYY-MM-DD". */
export interface MonthRange {
  from: string;
  to: string;
}

/**
 * The month that contains `today` ("2026-11-18" -> from "2026-11-01" to "2026-12-01").
 * `today` is the date in Libya (todayInTripoli), so "this month" is the owner's month, not the server's.
 */
export function monthOf(today: string): MonthRange {
  if (!isIsoDate(today)) throw new Error(`monthOf expects a "YYYY-MM-DD" date, got "${today}"`);
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)); // 1..12
  const pad = (n: number) => String(n).padStart(2, '0');
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  return { from: `${year}-${pad(month)}-01`, to: `${next.year}-${pad(next.month)}-01` };
}

export interface MonthSummary {
  /** Sum of the month's expenses in LYD (Decimal, 3 places). Zero when there are none. */
  total: Money;
  count: number;
}

/** «مصروفات هذا الشهر»: the total and the number of the month's expenses. */
export function monthSummary(amounts: readonly MoneyInput[]): MonthSummary {
  return { total: addMoney('0', ...amounts), count: amounts.length };
}
