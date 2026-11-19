// A quote's state next to its price: «عرض مورد», «ينتهي خلال 3 أيام» (FR-MAT-10), or «عرض منتهي» (FR-DEC-03: an expired
// quote is always marked). A paid price shows nothing.

import type { QuoteStatus } from '../domain/price';
import { priceTextAr } from './messages.ar';
import styles from './materials.module.css';

const t = priceTextAr.status;

export function StatusTag({ status }: { status: QuoteStatus }) {
  if (status.kind === 'paid') return null;
  const text = status.kind === 'open' ? t.quote : status.kind === 'expiring' ? t.expiring(status.daysLeft) : t.expired;
  return <span className={styles.tag}>{text}</span>;
}
