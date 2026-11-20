'use client';

// One action on an extra work (approve, reject, delete): the browser asks first, then the Server Action runs.

import { deleteExtraAction, setExtraStatusAction } from './extra-actions';
import styles from './expense.module.css';

interface Props {
  id: string;
  /** 'approved' | 'rejected' to change the status, or 'delete'. */
  action: 'approved' | 'rejected' | 'delete';
  label: string;
  ariaLabel: string;
  confirm: string;
}

export function ExtraButton({ id, action, label, ariaLabel, confirm }: Props) {
  const run = action === 'delete' ? deleteExtraAction.bind(null, id) : setExtraStatusAction.bind(null, id, action);
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
