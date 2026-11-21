'use client';

// One deletion (a contract or a payment): the browser asks first, then the Server Action runs.

import { deleteContractAction, deletePaymentAction } from './contract-actions';
import styles from './expense.module.css';

interface Props {
  contractId: string;
  /** Set to delete one payment; absent = delete the whole contract. */
  paymentId?: string;
  label: string;
  ariaLabel: string;
  confirm: string;
}

export function ContractButton({ contractId, paymentId, label, ariaLabel, confirm }: Props) {
  const run = paymentId ? deletePaymentAction.bind(null, contractId, paymentId) : deleteContractAction.bind(null, contractId);
  return (
    <form
      action={run}
      onSubmit={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
    >
      <button type="submit" className={styles.linkButton} aria-label={ariaLabel}>
        {label}
      </button>
    </form>
  );
}
