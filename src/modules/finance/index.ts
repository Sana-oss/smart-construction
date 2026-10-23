// Public API of the finance module. Other code imports ONLY from "@/modules/finance".
// Owns tables: budget_categories, expenses, exchange_rates, contracts, payments, change_orders.
export { budgetSummary, type BudgetSummary } from './domain/budget';
