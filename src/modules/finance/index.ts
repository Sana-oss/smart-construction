// Public API of the finance module. Other code imports ONLY from "@/modules/finance".
// Owns tables: budget_categories, expenses, exchange_rates, contracts, payments, change_orders, obligations, expected_income.

// Domain (pure)
export { budgetSummary, totalSpent, type BudgetSummary } from './domain/budget';
export {
  validateNewExpense,
  EXPENSE_NOTE_MAX,
  type NewExpenseInput,
  type ExpenseError,
  type ExpenseField,
  type ExpenseErrorCode,
} from './domain/expense';

// Record an expense (FR-FIN-02): the use case and its result. The Server Action and the quick-entry screen come
// with the next step (design from the teammate).
export { createExpense, type CreateExpenseCommand, type CreateExpenseResult } from './application/create-expense';
export type { ExpenseFailure } from './application/expense-gateway';
