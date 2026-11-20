// Routes of the finance screens.
/** Quick expense (design S14.1). */
export const EXPENSE_NEW_PATH = '/expenses/new';
/** Expenses list (design S13.1, empty state S13.3). */
export const EXPENSES_PATH = '/expenses';
/** One expense: edit and delete it (decision of 19 Nov 2026). */
export const expensePath = (id: string) => `/expenses/${id}`;
/** Filter the expenses list (design S13.2). The filter itself travels in the list's address (?q=&period=...). */
export const EXPENSES_FILTER_PATH = '/expenses/filter';
/** Obligations and expected income (design S16.1), and adding one (S16.2). */
export const CASHFLOW_PATH = '/cashflow';
export const CASHFLOW_NEW_PATH = '/cashflow/new';
/** The owner's reference exchange rates (3.18), and adding one. */
export const RATES_PATH = '/rates';
export const RATE_NEW_PATH = '/rates/new';
/** The budget (design S15.1), its plan per phase (S15.2) and the plan's form. */
export const BUDGET_PATH = '/budget';
export const BUDGET_PHASES_PATH = '/budget/phases';
export const BUDGET_EDIT_PATH = '/budget/phases/edit';
/** Extra works and changes (FR-FIN-10), and adding one. */
export const EXTRAS_PATH = '/budget/extras';
export const EXTRA_NEW_PATH = '/budget/extras/new';
