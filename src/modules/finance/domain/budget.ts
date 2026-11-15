import { addMoney, money, percentOf, subMoney, type Money, type MoneyInput } from '@/shared-kernel';

export interface BudgetSummary {
  total: Money;
  spent: Money;
  remaining: Money;
  contingency: Money;
  overBudget: boolean;
}

/**
 * The one definition of "spent" (decision 2 of 14 Nov 2026): money spent before using the app (a number kept on
 * the project) + the expenses recorded in the app. The database view budget_summary hands over both raw numbers
 * (migration 0007) and never adds them itself, so this is the only place that does.
 */
export function totalSpent(spentBefore: MoneyInput, recordedExpenses: MoneyInput): Money {
  return addMoney(spentBefore, recordedExpenses);
}

/** Pure budget math. The UI and n8n only display these numbers; they never compute them. */
export function budgetSummary(total: MoneyInput, spent: MoneyInput, contingencyPct: MoneyInput): BudgetSummary {
  const remaining = subMoney(total, spent);
  return {
    total: money(total),
    spent: money(spent),
    remaining,
    contingency: percentOf(total, contingencyPct),
    overBudget: remaining.isNegative(),
  };
}
