/** The state of the pay and release forms after a submit. The Server Actions are in src/app/contracts/[id]/payments/[paymentId]/actions.ts. */
export interface PayFormState {
  fieldErrors?: Partial<Record<'paidOn' | 'expenseType', string>>;
  formError?: string;
  /** The payment is not due and the owner did not tick the confirmation (D2): the form says so and asks. */
  needsConfirm?: boolean;
  values?: Partial<Record<'paidOn' | 'expenseType', string>>;
}

export interface ReleaseFormState {
  fieldErrors?: Partial<Record<'releasedOn' | 'expenseType', string>>;
  formError?: string;
  needsConfirm?: boolean;
  values?: Partial<Record<'releasedOn' | 'expenseType', string>>;
}
