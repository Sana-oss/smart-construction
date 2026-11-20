// Public API of the finance module. Other code imports ONLY from "@/modules/finance".
// Owns tables: budget_categories, expenses, exchange_rates, contracts, payments, change_orders, obligations, expected_income.

// Domain (pure)
export { budgetSummary, totalSpent, type BudgetSummary } from './domain/budget';
export {
  validateNewExpense,
  validateExpenseEdit,
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

// Expenses list (design S13.1, S13.3): the use case, the screen and its read
export { listExpenses, EXPENSE_LIST_LIMIT, type ExpenseList as ExpenseListData, type ExpenseListItem } from './application/list-expenses';
export { ExpenseList, type ExpenseListPhase } from './ui/ExpenseList';
export { getExpense, getExpenseList } from './ui/queries';

// Quick-expense screen (design S14.1, S14.2), its Server Action, route and text
export { QuickExpenseForm, type ExpensePhaseOption } from './ui/QuickExpenseForm';
export { createExpenseAction, type ExpenseFormState } from './ui/actions';
export { EXPENSE_NEW_PATH, EXPENSES_FILTER_PATH, EXPENSES_PATH, expensePath } from './ui/routes';

// Filter the expenses list (design S13.2)
export { filterQuery, parseExpenseFilter, type ExpenseFilter, type ExpenseFilterParams } from './domain/expense-filter';
export { ExpenseFilterForm } from './ui/ExpenseFilterForm';

// Edit and delete one expense (decision of 19 Nov 2026; the database audits every change, migration 0016)
export { EditExpenseForm } from './ui/EditExpenseForm';
export { updateExpense, deleteExpense, type UpdateExpenseCommand } from './application/change-expense';
export { expenseTextAr } from './ui/messages.ar';

// Obligations and expected income (design S16.1, S16.2; slice 1 of 3.7): screens, routes, and the outlook for 3.7
export { CashflowList } from './ui/CashflowList';
export { MovementForm } from './ui/MovementForm';
export { getCashflowView } from './ui/queries';
export { CASHFLOW_NEW_PATH, CASHFLOW_PATH } from './ui/routes';
export { cashflowTextAr } from './ui/messages.ar';
export { cashflowOutlook, currentLiquidity, CASHFLOW_HORIZON_DAYS, type CashflowOutlook, type Movement } from './domain/cashflow';
