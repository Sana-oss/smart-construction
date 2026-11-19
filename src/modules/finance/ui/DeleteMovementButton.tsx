'use client';

// Deleting an obligation or an expected income: the browser asks first (the audit log keeps the values, 0017).

import { deleteMovementAction } from './cashflow-actions';
import { cashflowTextAr as t } from './messages.ar';
import styles from './expense.module.css';

export function DeleteMovementButton({ kind, id, title }: { kind: string; id: string; title: string }) {
  return (
    <form
      action={deleteMovementAction.bind(null, kind, id)}
      onSubmit={(e) => {
        if (!window.confirm(t.deleteConfirm(title))) e.preventDefault();
      }}
    >
      <button type="submit" className={styles.linkButton} aria-label={t.deleteLabel(title)}>
        {t.delete}
      </button>
    </form>
  );
}
