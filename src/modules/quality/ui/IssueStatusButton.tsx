'use client';

// Moving a defect to another state (S28.3). Closing or reopening asks first; starting the fix does not.

import { setIssueStatusAction } from './issue-actions';
import styles from './quality.module.css';

export function IssueStatusButton({ id, status, label, confirm }: { id: string; status: 'open' | 'in_progress' | 'closed'; label: string; confirm?: string }) {
  return (
    <form
      action={setIssueStatusAction.bind(null, id, status)}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      <button type="submit" className={status === 'closed' ? styles.primary : styles.secondary}>
        {label}
      </button>
    </form>
  );
}
