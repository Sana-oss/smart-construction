// Public API of the finance module. Other code imports ONLY from "@/modules/finance".
// Owns tables: budget_categories, expenses, exchange_rates, contracts, payments, change_orders, obligations, expected_income.

// Domain (pure)
export { budgetSummary, totalSpent, type BudgetSummary } from './domain/budget';
export {
  validateNewExpense,
  EXPENSE_TYPES,
  type ExpenseType,
  type NewExpenseInput,
  type ExpenseError,
  type ExpenseField,
  type ExpenseErrorCode,
} from './domain/expense';

// Record an expense (FR-FIN-02): the use case and its result
export { createExpense, type CreateExpenseCommand, type CreateExpenseResult, type SavedExpense } from './application/create-expense';
export type { ExpenseFailure } from './application/expense-gateway';

// Quick-expense screen (design S14.1, S14.2), its Server Action, route and text
export { QuickExpenseForm, type ExpensePhaseOption } from './ui/QuickExpenseForm';
export { createExpenseAction, type ExpenseFormState } from './ui/actions';
export { EXPENSE_NEW_PATH } from './ui/routes';
export { expenseTextAr } from './ui/messages.ar';
