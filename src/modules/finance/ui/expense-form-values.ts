// The names of the expense form's fields, shared by the form (browser) and its Server Actions. A plain module: a
// Server Action must not import values from a 'use client' file (it would get a client reference, not the value).

export const EXPENSE_VALUE_FIELDS = [
  'title',
  'amount',
  'expenseType',
  'phaseId',
  'payee',
  'paidOn',
  // Foreign currency (3.18): optional, at the end of the form.
  'currency',
  'originalAmount',
  'rate',
] as const;
export type ExpenseValueField = (typeof EXPENSE_VALUE_FIELDS)[number];
export type ExpenseFormValues = Partial<Record<ExpenseValueField, string>>;
