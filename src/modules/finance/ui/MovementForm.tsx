'use client';

// Add an obligation or an expected income (design S16.2 «إضافة حركة متوقعة»): the five fields of the design.
// The server checks everything again (validateMovement in the finance domain); nothing from the browser is trusted.

import Link from 'next/link';
import { useActionState } from 'react';
import { MOVEMENT_KINDS, type MovementField } from '../domain/cashflow';
import { addMovementAction, type MovementFormState } from './cashflow-actions';
import { BackIcon } from './icons';
import { cashflowTextAr, expenseTextAr } from './messages.ar';
import styles from './expense.module.css';

const t = cashflowTextAr.form;
const FORM_ID = 'movement-form';

export function MovementForm({ backHref }: { backHref: string }) {
  const [state, formAction, pending] = useActionState(addMovementAction, {} as MovementFormState);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};
  const invalid = (name: MovementField) => ({
    'aria-invalid': errors[name] ? (true as const) : undefined,
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
  });
  const errorOf = (name: MovementField) =>
    errors[name] && (
      <p id={`${name}-error`} className={styles.fieldError}>
        {errors[name]}
      </p>
    );
  const star = <span aria-hidden="true">*</span>;

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
        {/* key: rebuild the form with the values sent back, so the <select> keeps its choice after a refusal. */}
        <form id={FORM_ID} action={formAction} noValidate key={JSON.stringify(values)}>
          {state.formError && (
            <p role="alert" className={styles.errorSummary}>
              {state.formError}
            </p>
          )}
          <p className={styles.hint}>{expenseTextAr.requiredHint}</p>

          <div className={styles.field}>
            <label htmlFor="kind" className={styles.label}>
              {t.kind} {star}
            </label>
            <select id="kind" name="kind" required className={styles.input} defaultValue={values.kind ?? ''} {...invalid('kind')}>
              <option value="" disabled>
                {t.kindPlaceholder}
              </option>
              {MOVEMENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t.kinds[k]}
                </option>
              ))}
            </select>
            {errorOf('kind')}
          </div>

          <div className={styles.field}>
            <label htmlFor="title" className={styles.label}>
              {t.title_} {star}
            </label>
            <input id="title" name="title" type="text" autoComplete="off" required className={styles.input} defaultValue={values.title ?? ''} {...invalid('title')} />
            {errorOf('title')}
          </div>

          <div className={styles.field}>
            <label htmlFor="amount" className={styles.label}>
              {t.amount} {star}
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
            <label htmlFor="date" className={styles.label}>
              {t.date} {star}
            </label>
            <input id="date" name="date" type="date" required className={styles.input} defaultValue={values.date ?? ''} {...invalid('date')} />
            {errorOf('date')}
          </div>

          <div className={styles.field}>
            <label htmlFor="party" className={styles.label}>
              {t.party} {star}
            </label>
            <input id="party" name="party" type="text" autoComplete="off" required className={styles.input} defaultValue={values.party ?? ''} {...invalid('party')} />
            {errorOf('party')}
          </div>
        </form>
      </div>

      <div className={styles.actions}>
        <button type="submit" form={FORM_ID} className={styles.primary} disabled={pending}>
          {pending ? t.submitting : t.submit}
        </button>
      </div>
    </main>
  );
}
