'use client';

// A button that runs a Server Action bound to one row, after the browser asks when `confirm` is set.

import styles from './quality.module.css';

export function ConfirmFormButton({ action, label, ariaLabel, confirm }: { action: () => Promise<void>; label: string; ariaLabel?: string; confirm?: string }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      <button type="submit" className={styles.linkButton} aria-label={ariaLabel}>
        {label}
      </button>
    </form>
  );
}
