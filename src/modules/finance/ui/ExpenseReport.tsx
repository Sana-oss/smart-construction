// The expenses report (FR-FIN-05; owner's decisions of 21 Nov 2026). Server Component: every number comes from the
// finance domain (expenseReport); this file only displays them (rule R5). There is no design screen for it: it is built
// from the design's components (summary card, list rows, quick links), and the change register says so.
// The period is a plain GET form (?period=), so it works without JavaScript, survives a reload and can be bookmarked.

import Link from 'next/link';
import { formatAmount, money, type Money } from '@/shared-kernel';
import type { ExpenseReportView } from '../application/expense-report';
import { EXPENSE_PERIODS } from '../domain/expense-filter';
import { REPORT_TYPES, type ReportRow, type ReportType, type TypeTotals } from '../domain/expense-report';
import { BackIcon } from './icons';
import { expenseCountAr, expensePeriodAr, expenseTextAr, expenseTypeAr, reportTextAr } from './messages.ar';
import { EXPENSES_REPORT_PATH } from './routes';
import styles from './expense.module.css';

const t = reportTextAr;
const Lyd = ({ value }: { value: Money | string }) => (
  <>
    <bdi dir="ltr">{formatAmount(value)}</bdi> {expenseTextAr.lyd}
  </>
);

const typeLabel = (type: ReportType) => (type === 'unspecified' ? t.unspecified : expenseTypeAr[type]);

/** «مواد 1,000 · عمالة 250» — only the types with money in them. */
function typesLine(byType: TypeTotals) {
  return REPORT_TYPES.filter((type) => !byType[type].isZero())
    .map((type) => `${typeLabel(type)} ${formatAmount(byType[type])}`)
    .join(' · ');
}

interface Props {
  view: ExpenseReportView;
  /** Phase names come from the projects module (the page passes them in). */
  phases: { id: string; name: string }[];
  /** Money spent before the app: not in the report (no phase, no date), said in a note. */
  spentBeforeLyd: string;
  backHref: string;
}

function PhaseRow({ row, name }: { row: ReportRow; name: string }) {
  const plan = row.plan;
  return (
    <li className={styles.listRow} data-over={plan?.over || undefined}>
      <span className={styles.rowText}>
        <strong>{name}</strong>
        <small>{row.count === 0 ? t.nothing : `${expenseCountAr(row.count)} · ${typesLine(row.byType)}`}</small>
        {plan && (
          <small>
            {plan.allocated !== null ? t.allocated(formatAmount(plan.allocated)) : t.noAllocation}
            {plan.usedPct !== null && ` · ${t.usedPct(plan.usedPct)}`}
          </small>
        )}
        {plan?.over && <strong>{t.over}</strong>}
      </span>
      <span className={styles.rowValue}>
        <Lyd value={row.spent} />
      </span>
    </li>
  );
}

export function ExpenseReport({ view, phases, spentBeforeLyd, backHref }: Props) {
  const { report, period } = view;
  const nameOf = (id: string | null) => (id === null ? t.noPhase : (phases.find((p) => p.id === id)?.name ?? t.noPhase));
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={backHref} className={styles.iconButton} aria-label={expenseTextAr.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.subtitle}>{t.subtitle}</p>
        </div>
      </header>

      <div className={styles.scroll}>
        <form action={EXPENSES_REPORT_PATH} method="get" className={styles.field}>
          <label htmlFor="period" className={styles.label}>
            {t.period}
          </label>
          <select id="period" name="period" className={styles.input} defaultValue={period}>
            {EXPENSE_PERIODS.map((p) => (
              <option key={p} value={p}>
                {expensePeriodAr[p]}
              </option>
            ))}
          </select>
          <button type="submit" className={styles.secondary}>
            {t.show}
          </button>
        </form>

        <div className={styles.summaryCard} aria-label={t.total(expensePeriodAr[period])}>
          <small>{t.total(expensePeriodAr[period])}</small>
          <strong>
            <Lyd value={report.total} />
          </strong>
          <p>{expenseCountAr(report.count)}</p>
        </div>

        <ul className={styles.list} aria-label={t.byType}>
          {REPORT_TYPES.filter((type) => type !== 'unspecified' || !report.byType.unspecified.isZero()).map((type) => (
            <li key={type} className={styles.listRow}>
              <span className={styles.rowText}>
                <strong>{typeLabel(type)}</strong>
              </span>
              <span className={styles.rowValue}>
                <Lyd value={report.byType[type]} />
              </span>
            </li>
          ))}
        </ul>

        <ul className={styles.list} aria-label={t.byPhase}>
          {report.rows.map((row) => (
            <PhaseRow key={row.phaseId ?? 'none'} row={row} name={nameOf(row.phaseId)} />
          ))}
        </ul>

        <p className={styles.hint}>{report.withPlan ? t.deviationNote : t.planNote}</p>
        {report.withPlan && !money(spentBeforeLyd).isZero() && <p className={styles.hint}>{t.before(formatAmount(spentBeforeLyd))}</p>}
      </div>

      <div className={styles.actions}>
        <Link href={backHref} className={styles.secondary}>
          {t.backToList}
        </Link>
      </div>
    </main>
  );
}
