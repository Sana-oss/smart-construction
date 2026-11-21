// Expenses list (FR-FIN-05 groundwork). Design: S13.1 «المصروفات», empty state S13.3.
// Server Component: the numbers come from the finance domain (monthSummary); this file only displays them (R5).
// With a filter (S13.2) the summary card shows the total of ALL the matching expenses (FR-FIN-05), not the month.
// Each row opens its expense for editing or deleting (decision of 19 Nov 2026).
// Not built yet (change register): the «عرض الميزانية» quick link of S13.1.

import Link from 'next/link';
import { formatAmount, type Money } from '@/shared-kernel';
import type { ExpenseList as ExpenseListData } from '../application/list-expenses';
import { filterQuery, isFiltered, type ExpenseFilter } from '../domain/expense-filter';
import { ForeignNote } from './ForeignNote';
import { BackIcon } from './icons';
import { expenseCountAr, expensePeriodAr, expenseTextAr, expenseTypeAr, reportTextAr } from './messages.ar';
import { EXPENSE_NEW_PATH, EXPENSES_FILTER_PATH, EXPENSES_PATH, EXPENSES_REPORT_PATH, expensePath } from './routes';
import styles from './expense.module.css';

const t = expenseTextAr.list;
const tf = expenseTextAr.filter;

/** The filter in words, e.g. «حديد» · الشهر الماضي · مواد. Display only. */
function describeFilter(f: ExpenseFilter, phaseName: (id: string | null) => string | undefined): string {
  return [
    f.search ? tf.searchFor(f.search) : null,
    f.period !== 'all' ? expensePeriodAr[f.period] : null,
    phaseName(f.phaseId) ?? null,
    f.expenseType ? expenseTypeAr[f.expenseType] : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

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
  /** Set after an edit or a deletion (the page reads it from the address): a short confirmation. */
  notice?: 'updated' | 'deleted' | null;
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

export function ExpenseList({ projectName, list, phases, homeHref, notice = null }: Props) {
  const filtered = isFiltered(list.filter);
  // S13.3 is for a project with no expenses at all; a filter that matches nothing has its own message.
  const empty = !filtered && list.totalCount === 0;
  const phaseName = (id: string | null) => (id ? phases.find((p) => p.id === id)?.name : undefined);
  const query = filterQuery(list.filter);
  const filterHref = query ? `${EXPENSES_FILTER_PATH}?${query}` : EXPENSES_FILTER_PATH;

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={homeHref} className={styles.iconButton} aria-label={expenseTextAr.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.subtitle}>
            {empty ? t.emptySubtitle : filtered ? tf.resultsSubtitle(projectName) : `${projectName} · ${monthYearAr(list.month.from)}`}
          </p>
        </div>
      </header>

      <div className={styles.scroll}>
        {notice && (
          <p role="status" className={styles.info}>
            {notice === 'updated' ? t.updated : t.deleted}
          </p>
        )}
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
            {filtered && (
              <div className={styles.filterBar}>
                <span>{describeFilter(list.filter, phaseName)}</span>
                <Link href={EXPENSES_PATH}>{tf.clear}</Link>
              </div>
            )}

            {/* Design S13.1; with a filter, the total of all the matching expenses. */}
            <div className={styles.summaryCard}>
              <small>{list.results ? tf.resultsTotal : t.monthTotal}</small>
              <strong>
                <Lyd value={list.results ? list.results.total : list.month.total} />
              </strong>
              <p>{expenseCountAr(list.results ? list.results.count : list.month.count)}</p>
            </div>

            {filtered && list.items.length === 0 && (
              <div className={styles.empty}>
                <strong>{tf.noResults}</strong>
                <p>{tf.noResultsHint}</p>
              </div>
            )}

            {list.items.length > 0 && (
              <ul className={styles.list} aria-label={t.title}>
                {list.items.map((e) => (
                  <li key={e.id} className={styles.listRow}>
                    <Link
                      href={expensePath(e.id)}
                      className={`${styles.rowText} ${styles.rowLink}`}
                      aria-label={t.openLabel(e.title || t.noTitle)}
                    >
                      <strong>{e.title || t.noTitle}</strong>
                      <small>
                        {[e.expenseType ? expenseTypeAr[e.expenseType] : null, phaseName(e.phaseId), dayMonthAr(e.paidOn)]
                          .filter(Boolean)
                          .join(' · ')}
                      </small>
                      {e.foreign && (
                        <small>
                          <ForeignNote foreign={e.foreign} />
                        </small>
                      )}
                    </Link>
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
            )}

            {list.totalCount > list.items.length && (
              <p role="note" className={styles.hint}>
                {t.olderHidden(list.items.length, list.totalCount)}
              </p>
            )}

            {/* Design S13.1 quick links: «التصفية والبحث» opens S13.2 with the filter in use. */}
            <nav className={styles.quickLinks} aria-label={tf.open}>
              <Link href={filterHref} className={styles.quickLink}>
                <span className={styles.rowText}>
                  <strong>{tf.open}</strong>
                  <small>{tf.openNote}</small>
                </span>
              </Link>
              {/* FR-FIN-05: not in design S13.1; added with the report (decision of 21 Nov 2026). */}
              <Link href={EXPENSES_REPORT_PATH} className={styles.quickLink}>
                <span className={styles.rowText}>
                  <strong>{reportTextAr.open}</strong>
                  <small>{reportTextAr.openNote}</small>
                </span>
              </Link>
            </nav>
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
