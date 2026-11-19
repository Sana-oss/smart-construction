// Routes of the finance screens.
/** Quick expense (design S14.1). */
export const EXPENSE_NEW_PATH = '/expenses/new';
/** Expenses list (design S13.1, empty state S13.3). */
export const EXPENSES_PATH = '/expenses';
/** One expense: edit and delete it (decision of 19 Nov 2026). */
export const expensePath = (id: string) => `/expenses/${id}`;
/** Filter the expenses list (design S13.2). The filter itself travels in the list's address (?q=&period=...). */
export const EXPENSES_FILTER_PATH = '/expenses/filter';
