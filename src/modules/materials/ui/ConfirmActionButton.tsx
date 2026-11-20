'use client';

// A button that runs a Server Action bound to one row, after the browser asks (deleting a line), or straight away
// (finishing a purchase's expense: it can only do the missing step, never a second expense).

import styles from './materials.module.css';

interface Props {
  action: () => Promise<void>;
  label: string;
  ariaLabel?: string;
  /** When set, the browser asks this before running the action. */
  confirm?: string;
  variant?: 'link' | 'secondary';
}

export function ConfirmActionButton({ action, label, ariaLabel, confirm, variant = 'link' }: Props) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      <button type="submit" className={variant === 'link' ? styles.linkButton : styles.secondary} aria-label={ariaLabel}>
        {label}
      </button>
    </form>
  );
}
