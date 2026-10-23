import { money, percentOf, subMoney, type Money, type MoneyInput } from '@/shared-kernel';

export interface BudgetSummary {
  total: Money;
  spent: Money;
  remaining: Money;
  contingency: Money;
  overBudget: boolean;
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
