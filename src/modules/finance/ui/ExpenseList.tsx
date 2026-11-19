// Expenses list (FR-FIN-05 groundwork). Design: S13.1 «المصروفات», empty state S13.3.
// Server Component: the numbers come from the finance domain (monthSummary); this file only displays them (R5).
// Not built yet (recorded in the change register): the filter screen S13.2 and «عرض الميزانية» quick links,
// the bottom navigation bar, and opening one expense.

import Link from 'next/link';
import { formatAmount, type Money } from '@/shared-kernel';
import type { ExpenseList as ExpenseListData } from '../application/list-expenses';
import { BackIcon } from './icons';
import { expenseCountAr, expenseTextAr, expenseTypeAr } from './messages.ar';
import { EXPENSE_NEW_PATH } from './routes';
import styles from './expense.module.css';

const t = expenseTextAr.list;

export interface ExpenseListPhase {
  id: string;
  name: string;
}

interface Props {
  projectName: string;
  list: ExpenseListData;
  /** Phase names come from the projects module (the page passes them in). */
  phases: ExpenseListPhase[];
  /** Where the back button goes (the dashboard). */
  homeHref: string;
}

/** "2026-11-09" -> "9 نوفمبر". Noon UTC keeps the day the same in every time zone. */
const dayMonthAr = (iso: string) =>
  new Intl.DateTimeFormat('ar-LY', { day: 'numeric', month: 'long', timeZone: 'Africa/Tripoli' }).format(
    new Date(`${iso}T12:00:00Z`),
  );

/** "2026-11-01" -> "نوفمبر 2026" (the summary card's month). */
const monthYearAr = (iso: string) =>
  new Intl.DateTimeFormat('ar-LY', { month: 'long', year: 'numeric', timeZone: 'Africa/Tripoli' }).format(
    new Date(`${iso}T12:00:00Z`),
  );

/** <bdi dir="ltr"> keeps the digits in the right order inside Arabic text. */
const Lyd = ({ value }: { value: Money | string }) => (
  <>
    <bdi dir="ltr">{formatAmount(value)}</bdi> {expenseTextAr.lyd}
  </>
);

export function ExpenseList({ projectName, list, phases, homeHref }: Props) {
  const empty = list.totalCount === 0;
  const phaseName = (id: string | null) => (id ? phases.find((p) => p.id === id)?.name : undefined);

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={homeHref} className={styles.iconButton} aria-label={expenseTextAr.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.subtitle}>{empty ? t.emptySubtitle : `${projectName} · ${monthYearAr(list.month.from)}`}</p>
        </div>
      </header>

      <div className={styles.scroll}>
        {empty ? (
          <>
            {/* Design S13.3 */}
            <div className={styles.summaryCard}>
              <small>{t.allTotal}</small>
              <strong>
                <Lyd value="0" />
              </strong>
              <p>{t.startHint}</p>
            </div>
            <div className={styles.empty}>
              <strong>{t.emptyTitle}</strong>
              <p>{t.emptyBody}</p>
            </div>
          </>
        ) : (
          <>
            {/* Design S13.1 */}
            <div className={styles.summaryCard}>
              <small>{t.monthTotal}</small>
              <strong>
                <Lyd value={list.month.total} />
              </strong>
              <p>{expenseCountAr(list.month.count)}</p>
            </div>

            <ul className={styles.list} aria-label={t.title}>
              {list.items.map((e) => (
                <li key={e.id} className={styles.listRow}>
                  <span className={styles.rowText}>
                    <strong>{e.title || t.noTitle}</strong>
                    <small>
                      {[e.expenseType ? expenseTypeAr[e.expenseType] : null, phaseName(e.phaseId), dayMonthAr(e.paidOn)]
                        .filter(Boolean)
                        .join(' · ')}
                    </small>
                  </span>
                  <span className={styles.rowValue}>
                    <Lyd value={e.amountLyd} />
                    {e.receiptUrl && (
                      // Receipt photo (UC-07), through a short-lived signed link (NFR-SEC-03).
                      <a
                        href={e.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.receiptLink}
                        aria-label={t.receiptLabel(e.title || t.noTitle)}
                      >
                        {t.receipt}
                      </a>
                    )}
                  </span>
                </li>
              ))}
            </ul>

            {list.totalCount > list.items.length && (
              <p role="note" className={styles.hint}>
                {t.olderHidden(list.items.length, list.totalCount)}
              </p>
            )}
          </>
        )}
      </div>

      <div className={styles.actions}>
        <Link href={EXPENSE_NEW_PATH} className={styles.primary}>
          {empty ? t.addFirst : t.add}
        </Link>
      </div>
    </main>
  );
}
