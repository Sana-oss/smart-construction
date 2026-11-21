import type { ContractField } from '../domain/contracts';

export const CONTRACT_FORM_FIELDS = ['title', 'contractor', 'value', 'scope', 'cleanupClause', 'documentId'] as const;

/** The state of the contract form after a submit. The Server Action itself is in src/app/contracts/actions.ts. */
export interface ContractFormState {
  fieldErrors?: Partial<Record<ContractField, string>>;
  formError?: string;
  values?: Partial<Record<(typeof CONTRACT_FORM_FIELDS)[number], string>>;
}
