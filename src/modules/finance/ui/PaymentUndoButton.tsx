'use client';

// Undoing a payment or a release: the browser asks first, then the Server Action (bound to the payment by the page) runs.

import styles from './expense.module.css';

interface Props {
  action: () => Promise<void>;
  label: string;
  ariaLabel: string;
  confirm: string;
}

export function PaymentUndoButton({ action, label, ariaLabel, confirm }: Props) {
  return (
    <form
      action={action}
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
