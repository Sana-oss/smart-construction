// Filter the expenses list (design S13.2 «تصفية المصروفات»): search, period, phase, type, then «تطبيق التصفية» or
// «مسح التصفية». A plain GET form to the list: the filter lives in the list's address (?q=&period=&phase=&type=), so
// it works without JavaScript, survives a reload and can be bookmarked. The list checks every value again
// (parseExpenseFilter), so a hand-made address cannot do anything the form cannot.

import Link from 'next/link';
import { EXPENSE_PERIODS, type ExpenseFilter } from '../domain/expense-filter';
import { EXPENSE_TYPES } from '../domain/expense';
import { BackIcon } from './icons';
import { expensePeriodAr, expenseTextAr, expenseTypeAr } from './messages.ar';
import { EXPENSES_PATH } from './routes';
import styles from './expense.module.css';

const t = expenseTextAr.filter;
const FORM_ID = 'expense-filter-form';

interface Props {
  /** The filter in use, so the form opens with it. */
  filter: ExpenseFilter;
  /** Phase names come from the projects module (the page passes them in). */
  phases: { id: string; name: string }[];
  /** Where the back button goes: the list, with the filter in use. */
  backHref: string;
}

export function ExpenseFilterForm({ filter, phases, backHref }: Props) {
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
        <form id={FORM_ID} action={EXPENSES_PATH} method="get" role="search">
          <div className={styles.field}>
            <label htmlFor="q" className={styles.label}>
              {t.search}
            </label>
            <input id="q" name="q" type="search" autoComplete="off" className={styles.input} defaultValue={filter.search} />
          </div>

          <div className={styles.field}>
            <label htmlFor="period" className={styles.label}>
              {t.period}
            </label>
            <select id="period" name="period" className={styles.input} defaultValue={filter.period}>
              {EXPENSE_PERIODS.map((p) => (
                <option key={p} value={p}>
                  {expensePeriodAr[p]}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label htmlFor="phase" className={styles.label}>
              {t.phase}
            </label>
            <select id="phase" name="phase" className={styles.input} defaultValue={filter.phaseId ?? ''}>
              <option value="">{t.allPhases}</option>
              {phases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label htmlFor="type" className={styles.label}>
              {t.type}
            </label>
            <select id="type" name="type" className={styles.input} defaultValue={filter.expenseType ?? ''}>
              <option value="">{t.allTypes}</option>
              {EXPENSE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {expenseTypeAr[type]}
                </option>
              ))}
            </select>
          </div>
        </form>
      </div>

      <div className={styles.actions}>
        <button type="submit" form={FORM_ID} className={styles.primary}>
          {t.apply}
        </button>
        <Link href={EXPENSES_PATH} className={styles.secondary}>
          {t.clear}
        </Link>
      </div>
    </main>
  );
}
