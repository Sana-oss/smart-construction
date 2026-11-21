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

// The expenses report (FR-FIN-05): by phase and type for a period; planned against actual for «كل الفترات»
export { ExpenseReport } from './ui/ExpenseReport';
export { getExpenseReportView } from './ui/queries';
export { EXPENSES_REPORT_PATH } from './ui/routes';
export { reportTextAr } from './ui/messages.ar';

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

// Foreign currency and reference rates (3.18, FR-FIN-04; decisions of 20 Nov 2026)
export { RateLog } from './ui/RateLog';
export { RateForm } from './ui/RateForm';
export { getLatestRates, getRateLogView } from './ui/queries';
export { RATE_NEW_PATH, RATES_PATH } from './ui/routes';
export { currencyTextAr } from './ui/messages.ar';

// The budget plan (design S15.1, S15.2; FR-FIN-11; 3.16 financial part, slice 1)
export { BudgetOverview } from './ui/BudgetOverview';
export { PhaseBudget } from './ui/PhaseBudget';
export { AllocationForm } from './ui/AllocationForm';
export { getProjectBudget } from './ui/queries';
export { BUDGET_EDIT_PATH, BUDGET_PATH, BUDGET_PHASES_PATH } from './ui/routes';
export { budgetTextAr } from './ui/messages.ar';

// Extra works and changes (FR-FIN-10; 3.16 financial part, slice 2)
export { ExtrasList } from './ui/ExtrasList';
export { ExtraForm } from './ui/ExtraForm';
export { getExtrasView } from './ui/queries';
export { EXTRA_NEW_PATH, EXTRAS_PATH } from './ui/routes';
export { extrasTextAr } from './ui/messages.ar';

// Contracts and the payment schedule (design S17.1, S17.2; FR-FIN-08, FR-FIN-09; 3.16 contractual part, slice 1)
export { ContractList } from './ui/ContractList';
export { ContractDetail } from './ui/ContractDetail';
export { ContractForm } from './ui/ContractForm';
export { PaymentForm } from './ui/PaymentForm';
export { getContractsView, getContractDetail } from './ui/queries';
export { saveContract, changeContract } from './ui/contract-save';
export { addPaymentAction, updatePaymentAction } from './ui/contract-actions';
export { getContractExtras } from './ui/queries';
export { CONTRACT_FORM_FIELDS, type ContractFormState } from './ui/contract-form-state';
export { CONTRACTS_PATH, CONTRACT_NEW_PATH, contractPath, contractEditPath, paymentNewPath, paymentEditPath } from './ui/routes';
export { contractsTextAr, contractErrorsAr, contractFailedAr, contractCountAr } from './ui/messages.ar';

// Paying an installment and releasing the retained part (design S17.3; FR-FIN-09; 3.16 contractual part, slice 2)
export { PaymentDetail } from './ui/PaymentDetail';
export { payPayment, releasePayment, undoPaymentPaid, undoPaymentRelease } from './ui/payment-settle';
export { paymentDue, type DueState } from './domain/payments';
export { paymentPath } from './ui/routes';
export { settleTextAr, settleErrorsAr, settleFailedAr } from './ui/messages.ar';
export type { PayFormState, ReleaseFormState } from './ui/settle-form-state';
export type { ContractsView } from './application/contracts';

// Event handler: purchase.recorded -> one expense (FR-FIN-03). Called by the app right after a purchase is saved.
export { recordPurchaseExpense } from './ui/purchase-expense';
