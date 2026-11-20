'use client';

// The six fields of an expense (design S14.1): name, amount, type, phase, supplier, date. Shared by the quick-expense
// form and the edit form (decision of 19 Nov 2026), so both show and send exactly the same fields.
// Then an optional, closed section «دُفع بعملة أخرى» (3.18, FR-FIN-04; decision of 20 Nov 2026): once a currency is
// chosen, the LYD amount is not typed but shown, computed by the domain (validateForeign: original × rate), and the
// server computes it again. Someone who never opens the section sees the form exactly as before (NFR-USE-03).

import { useState } from 'react';
import { formatAmount } from '@/shared-kernel';
import { CURRENCIES, validateForeign, type Currency } from '../domain/currency';
import { EXPENSE_TYPES, type ExpenseField } from '../domain/expense';
import type { ExpenseFormValues } from './expense-form-values';
import { currencyTextAr as c, expenseTextAr as t, expenseTypeAr, type ExpenseFieldErrors } from './messages.ar';
import styles from './expense.module.css';

/** The latest reference rate of each currency in the owner's log, to start the rate field with. */
export type LatestRates = Partial<Record<Currency, { lydPerUnit: string; rateDate: string }>>;

/** "7.2500" -> "7.25" for the field (the stored value keeps 4 places). */
const plainRate = (r: string) => r.replace(/\.?0+$/, '');
const dayMonthAr = (iso: string) =>
  new Intl.DateTimeFormat('ar-LY', { day: 'numeric', month: 'long', timeZone: 'Africa/Tripoli' }).format(new Date(`${iso}T12:00:00Z`));

interface Props {
  phases: { id: string; name: string }[];
  /** Today's date in Libya, "YYYY-MM-DD": the latest date the picker offers. */
  today: string;
  /** What each field starts with. */
  values: ExpenseFormValues;
  errors: ExpenseFieldErrors;
  /** The edit form requires the date (an empty date would move the expense to today). */
  dateRequired?: boolean;
  /** The owner's latest reference rates (3.18). */
  rates: LatestRates;
}

export function ExpenseFields({ phases, today, values, errors, dateRequired = false, rates }: Props) {
  const [currency, setCurrency] = useState(values.currency ?? '');
  const [originalAmount, setOriginalAmount] = useState(values.originalAmount ?? '');
  const [rate, setRate] = useState(values.rate ?? '');
  const foreign = currency !== '' ? validateForeign({ currency, originalAmount, rate }) : null;
  const latest = currency !== '' ? rates[currency as Currency] : undefined;
  /** Choosing a currency starts the rate at the owner's latest one; the owner can still change it. */
  const chooseCurrency = (next: string) => {
    setCurrency(next);
    const r = rates[next as Currency];
    setRate(r ? plainRate(r.lydPerUnit) : '');
  };

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
        {currency === '' ? (
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
        ) : (
          <>
            <input
              id="amount"
              type="text"
              dir="ltr"
              readOnly
              className={styles.input}
              value={foreign?.ok ? formatAmount(foreign.value.amountLyd) : ''}
              aria-describedby="amount-from-foreign"
            />
            <p id="amount-from-foreign" className={styles.hint}>
              {c.amountFromForeign}
            </p>
          </>
        )}
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

      <details className={styles.field} open={currency !== '' || undefined}>
        <summary className={styles.label}>
          {c.section} <small className={styles.optional}>({c.sectionOptional})</small>
        </summary>
        <div className={styles.field}>
          <label htmlFor="currency" className={styles.label}>
            {c.currency}
          </label>
          <select
            id="currency"
            name="currency"
            className={styles.input}
            value={currency}
            onChange={(e) => chooseCurrency(e.target.value)}
            {...invalid('currency')}
          >
            <option value="">{c.currencyNone}</option>
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {c.names[code]} ({code})
              </option>
            ))}
          </select>
          {errorOf('currency')}
        </div>
        {currency !== '' && (
          <>
            <div className={styles.field}>
              <label htmlFor="originalAmount" className={styles.label}>
                {c.originalAmount(currency)} {star}
              </label>
              <input
                id="originalAmount"
                name="originalAmount"
                type="text"
                inputMode="decimal"
                dir="ltr"
                autoComplete="off"
                className={styles.input}
                value={originalAmount}
                onChange={(e) => setOriginalAmount(e.target.value)}
                {...invalid('originalAmount')}
              />
              {errorOf('originalAmount')}
            </div>
            <div className={styles.field}>
              <label htmlFor="rate" className={styles.label}>
                {c.rate(currency)} {star}
              </label>
              <input
                id="rate"
                name="rate"
                type="text"
                inputMode="decimal"
                dir="ltr"
                autoComplete="off"
                className={styles.input}
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                aria-invalid={errors.rate ? true : undefined}
                aria-describedby={errors.rate ? 'rate-hint rate-error' : 'rate-hint'}
              />
              <p id="rate-hint" className={styles.hint}>
                {latest ? c.latest(plainRate(latest.lydPerUnit), dayMonthAr(latest.rateDate)) : c.noLatest} {c.rateHint}
              </p>
              {errorOf('rate')}
            </div>
            <p role="status" className={styles.info}>
              {c.equivalent}:{' '}
              {foreign?.ok ? (
                <>
                  <bdi dir="ltr">{formatAmount(foreign.value.amountLyd)}</bdi> {t.lyd}
                </>
              ) : (
                '—'
              )}
              <br />
              <small>{c.equivalentHint}</small>
            </p>
          </>
        )}
      </details>
    </>
  );
}
