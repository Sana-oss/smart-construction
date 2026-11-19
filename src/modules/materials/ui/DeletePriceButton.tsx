'use client';

// Deleting a price: the browser asks first (the audit log keeps its values, 0018).

import { deletePriceAction } from './price-actions';
import { priceTextAr } from './messages.ar';
import styles from './materials.module.css';

const t = priceTextAr.history;

export function DeletePriceButton({ id, material, unit, date }: { id: string; material: string; unit: string; date: string }) {
  return (
    <form
      action={deletePriceAction.bind(null, id, material, unit)}
      onSubmit={(e) => {
        if (!window.confirm(t.deleteConfirm(date))) e.preventDefault();
      }}
    >
      <button type="submit" className={styles.linkButton} aria-label={t.deleteLabel(date)}>
        {t.delete}
      </button>
    </form>
  );
}
