// The six fields of an expense (design S14.1): name, amount, type, phase, supplier, date. Shared by the quick-expense
// form and the edit form (decision of 19 Nov 2026), so both show and send exactly the same fields.

import { EXPENSE_TYPES, type ExpenseField } from '../domain/expense';
import { expenseTextAr as t, expenseTypeAr, type ExpenseFieldErrors } from './messages.ar';
import styles from './expense.module.css';

export const EXPENSE_VALUE_FIELDS = ['title', 'amount', 'expenseType', 'phaseId', 'payee', 'paidOn'] as const;
export type ExpenseValueField = (typeof EXPENSE_VALUE_FIELDS)[number];
export type ExpenseFormValues = Partial<Record<ExpenseValueField, string>>;

interface Props {
  phases: { id: string; name: string }[];
  /** Today's date in Libya, "YYYY-MM-DD": the latest date the picker offers. */
  today: string;
  /** What each field starts with. */
  values: ExpenseFormValues;
  errors: ExpenseFieldErrors;
  /** The edit form requires the date (an empty date would move the expense to today). */
  dateRequired?: boolean;
}

export function ExpenseFields({ phases, today, values, errors, dateRequired = false }: Props) {
  const invalid = (name: ExpenseField) => ({
    'aria-invalid': errors[name] ? (true as const) : undefined,
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
  });
  const errorOf = (name: ExpenseField) =>
    errors[name] && (
      <p id={`${name}-error`} className={styles.fieldError}>
        {errors[name]}
      </p>
    );
  const star = <span aria-hidden="true">*</span>;

  return (
    <>
      <div className={styles.field}>
        <label htmlFor="title" className={styles.label}>
          {t.form.name} {star}
        </label>
        <input
          id="title"
          name="title"
          type="text"
          autoComplete="off"
          required
          className={styles.input}
          defaultValue={values.title ?? ''}
          {...invalid('title')}
        />
        {errorOf('title')}
      </div>

      <div className={styles.field}>
        <label htmlFor="amount" className={styles.label}>
          {t.form.amount} {star}
        </label>
        <input
          id="amount"
          name="amount"
          type="text"
          inputMode="decimal"
          dir="ltr"
          autoComplete="off"
          required
          className={styles.input}
          defaultValue={values.amount ?? ''}
          {...invalid('amount')}
        />
        {errorOf('amount')}
      </div>

      <div className={styles.field}>
        <label htmlFor="expenseType" className={styles.label}>
          {t.form.type} {star}
        </label>
        <select
          id="expenseType"
          name="expenseType"
          required
          className={styles.input}
          defaultValue={values.expenseType ?? ''}
          {...invalid('expenseType')}
        >
          <option value="" disabled>
            {t.form.typePlaceholder}
          </option>
          {EXPENSE_TYPES.map((type) => (
            <option key={type} value={type}>
              {expenseTypeAr[type]}
            </option>
          ))}
        </select>
        {errorOf('expenseType')}
      </div>

      <div className={styles.field}>
        <label htmlFor="phaseId" className={styles.label}>
          {t.form.phase}
        </label>
        <select id="phaseId" name="phaseId" className={styles.input} defaultValue={values.phaseId ?? ''} {...invalid('phaseId')}>
          <option value="">{t.form.noPhase}</option>
          {phases.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {errorOf('phaseId')}
      </div>

      <div className={styles.field}>
        <label htmlFor="payee" className={styles.label}>
          {t.form.payee}
        </label>
        <input
          id="payee"
          name="payee"
          type="text"
          autoComplete="off"
          className={styles.input}
          defaultValue={values.payee ?? ''}
          {...invalid('payee')}
        />
        {errorOf('payee')}
      </div>

      <div className={styles.field}>
        <label htmlFor="paidOn" className={styles.label}>
          {t.form.date} {dateRequired && star}
        </label>
        <input
          id="paidOn"
          name="paidOn"
          type="date"
          max={today}
          required={dateRequired}
          className={styles.input}
          defaultValue={values.paidOn ?? ''}
          {...invalid('paidOn')}
        />
        {errorOf('paidOn')}
      </div>
    </>
  );
}
