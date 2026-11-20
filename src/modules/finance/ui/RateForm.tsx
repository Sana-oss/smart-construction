'use client';

// Add a reference exchange rate (3.18; decision of 20 Nov 2026): currency, LYD for one unit, date, note.

import Link from 'next/link';
import { useActionState } from 'react';
import { CURRENCIES, type RateField } from '../domain/currency';
import { addRateAction, type RateFormState } from './rate-actions';
import { BackIcon } from './icons';
import { currencyTextAr, expenseTextAr } from './messages.ar';
import styles from './expense.module.css';

const t = currencyTextAr.form;
const FORM_ID = 'rate-form';

export function RateForm({ backHref, today }: { backHref: string; today: string }) {
  const [state, formAction, pending] = useActionState(addRateAction, {} as RateFormState);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? { rateDate: today };
  const invalid = (name: RateField) => ({
    'aria-invalid': errors[name] ? (true as const) : undefined,
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
  });
  const errorOf = (name: RateField) =>
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
        <form id={FORM_ID} action={formAction} noValidate key={JSON.stringify(state.values ?? {})}>
          {state.formError && (
            <p role="alert" className={styles.errorSummary}>
              {state.formError}
            </p>
          )}
          <p className={styles.hint}>{expenseTextAr.requiredHint}</p>

          <div className={styles.field}>
            <label htmlFor="currency" className={styles.label}>
              {t.currency} {star}
            </label>
            <select id="currency" name="currency" className={styles.input} defaultValue={values.currency ?? ''} {...invalid('currency')}>
              <option value="" disabled>
                {t.currencyPlaceholder}
              </option>
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {currencyTextAr.names[code]} ({code})
                </option>
              ))}
            </select>
            {errorOf('currency')}
          </div>

          <div className={styles.field}>
            <label htmlFor="rate" className={styles.label}>
              {t.rate} {star}
            </label>
            <input id="rate" name="rate" type="text" inputMode="decimal" dir="ltr" autoComplete="off" className={styles.input} defaultValue={values.rate ?? ''} {...invalid('rate')} />
            {errorOf('rate')}
          </div>

          <div className={styles.field}>
            <label htmlFor="rateDate" className={styles.label}>
              {t.date}
            </label>
            <input id="rateDate" name="rateDate" type="date" max={today} className={styles.input} defaultValue={values.rateDate ?? today} {...invalid('rateDate')} />
            {errorOf('rateDate')}
          </div>

          <div className={styles.field}>
            <label htmlFor="note" className={styles.label}>
              {t.note} <small className={styles.optional}>({t.optional})</small>
            </label>
            <input id="note" name="note" type="text" autoComplete="off" placeholder={t.notePlaceholder} className={styles.input} defaultValue={values.note ?? ''} {...invalid('note')} />
            {errorOf('note')}
          </div>
        </form>
        <p role="note" className={styles.hint}>
          {currencyTextAr.log.notice}
        </p>
      </div>

      <div className={styles.actions}>
        <button type="submit" form={FORM_ID} className={styles.primary} disabled={pending}>
          {pending ? t.submitting : t.submit}
        </button>
      </div>
    </main>
  );
}
