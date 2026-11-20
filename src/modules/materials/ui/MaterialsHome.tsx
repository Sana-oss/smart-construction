// Materials home (design S20.1 «المواد والكميات»; 3.3). The quantity table («بنود المواد») with what was bought and
// what is left of each line (FR-MAT-02), the over-allowance warning (FR-MAT-03), and the tools: the calculators and
// the price log. The design's «جرد المتبقي» waits for 3.23 (stock count). Server Component: every number comes from
// the materials domain (itemProgress); this file only displays it (rule R5).

import Link from 'next/link';
import { formatAmount } from '@/shared-kernel';
import type { QuantityTable } from '../application/quantities';
import { calcTextAr, qtyTextAr } from './messages.ar';
import { CALCULATORS_PATH, ITEM_NEW_PATH, itemPath, PRICES_PATH, REBAR_PATH } from './routes';
import styles from './materials.module.css';

const t = calcTextAr.home;
const q = qtyTextAr.table;

interface Props {
  table: QuantityTable;
  notice?: 'deleted' | null;
}

export function MaterialsHome({ table, notice = null }: Props) {
  const link = (href: string, title: string, note: string) => (
    <Link href={href} className={styles.quickLink}>
      <span className={styles.rowText}>
        <strong>{title}</strong>
        <small>{note}</small>
      </span>
    </Link>
  );
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.subtitle}>{t.subtitle}</p>
        </div>
      </header>
      <div className={styles.scroll}>
        {notice === 'deleted' && (
          <p role="status" className={styles.info}>
            {q.deleted}
          </p>
        )}
        {table.overCount > 0 && (
          <p role="status" className={styles.errorSummary}>
            {q.overCount(table.overCount)}
          </p>
        )}
        {table.pendingExpenses > 0 && (
          <p role="status" className={styles.info}>
            {q.pendingCount(table.pendingExpenses)}
          </p>
        )}

        <section aria-labelledby="items-title">
          <h2 id="items-title" className={styles.label}>
            {q.title} · {q.count(table.items.length)}
          </h2>
          {table.items.length === 0 ? (
            <div className={styles.empty}>
              <strong>{q.empty}</strong>
              <p>{q.emptyNote}</p>
            </div>
          ) : (
            <>
              <p className={styles.hint}>{q.note}</p>
              <ul className={styles.list} aria-label={q.title}>
                {table.items.map(({ item, progress }) => (
                  <li key={item.id} className={styles.listRow}>
                    <Link href={itemPath(item.id)} className={`${styles.rowText} ${styles.rowLink}`} aria-label={q.open(item.material)}>
                      <strong>{item.material}</strong>
                      <small>{q.progress(formatAmount(progress.plannedQty), formatAmount(progress.purchasedQty), item.unit)}</small>
                    </Link>
                    <span className={styles.rowValue}>
                      {progress.isOver ? q.over(formatAmount(progress.overBy), item.unit) : q.remaining(formatAmount(progress.remainingQty), item.unit)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <nav className={styles.quickLinks} aria-label={t.linksLabel}>
          {link(REBAR_PATH, t.rebar, t.rebarNote)}
          {link(CALCULATORS_PATH, t.others, t.othersNote)}
          {link(PRICES_PATH, t.prices, t.pricesNote)}
        </nav>
      </div>

      <div className={styles.actions}>
        <Link href={ITEM_NEW_PATH} className={styles.primary}>
          {q.add}
        </Link>
      </div>
    </main>
  );
}
