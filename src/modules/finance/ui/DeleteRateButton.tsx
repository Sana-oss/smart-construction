'use client';

// Deleting a reference rate: the browser asks first. No expense changes (each keeps its own rate).

import { deleteRateAction } from './rate-actions';
import { currencyTextAr } from './messages.ar';
import styles from './expense.module.css';

const t = currencyTextAr.log;

export function DeleteRateButton({ id, currency, date }: { id: string; currency: string; date: string }) {
  return (
    <form
      action={deleteRateAction.bind(null, id)}
      onSubmit={(e) => {
        if (!window.confirm(t.deleteConfirm(currency, date))) e.preventDefault();
      }}
    >
      <button type="submit" className={styles.linkButton} aria-label={t.deleteLabel(currency, date)}>
        {t.delete}
      </button>
    </form>
  );
}
