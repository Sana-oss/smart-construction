'use client';

// Quick expense (FR-FIN-02, UC-07). Design: S14.1 «مصروف سريع» and S14.2 «تم حفظ المصروف».
// Six fields, as in the design: name, amount, type, phase, supplier or beneficiary, date. The owner types
// three (name, amount, type); the phase starts on the current phase, the date on today, the supplier is optional.
// Not built yet: the bottom navigation bar and the "عرض المصروفات" button (the expenses list does not exist
// yet), so the saved screen offers "back to the dashboard" instead.
// The form posts to createExpenseAction (a Server Action); all rules are checked again on the server.

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { formatAmount } from '@/shared-kernel';
import type { SavedExpense } from '../application/create-expense';
import { EXPENSE_TYPES, type ExpenseField } from '../domain/expense';
import { createExpenseAction, type ExpenseFormState } from './actions';
import { BackIcon } from './icons';
import { expenseTextAr as t, expenseTypeAr } from './messages.ar';
import styles from './expense.module.css';

export interface ExpensePhaseOption {
  id: string;
  name: string;
  /** True for the phase the project is in now: the form starts on it. */
  current: boolean;
}

interface Props {
  phases: ExpensePhaseOption[];
  /** Today's date in Libya, "YYYY-MM-DD", from the server. */
  today: string;
  /** Where the back button and "back to the dashboard" go. */
  homeHref: string;
}

const initialState: ExpenseFormState = {};
const FORM_ID = 'quick-expense-form';

/** "2026-11-09" -> "9 نوفمبر 2026". Noon UTC keeps the day the same in every time zone. */
const dateAr = (iso: string) =>
  new Intl.DateTimeFormat('ar-LY', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Tripoli' }).format(
    new Date(`${iso}T12:00:00Z`),
  );

/**
 * One "round" = one expense. Pressing «إضافة مصروف آخر» starts a new round: React builds a fresh form (the
 * `key` changes), with an empty state and a NEW client_op_id.
 */
export function QuickExpenseForm(props: Props) {
  const [round, setRound] = useState(0);
  return <ExpenseRound key={round} {...props} onAnother={() => setRound((r) => r + 1)} />;
}

function ExpenseRound({ phases, today, homeHref, onAnother }: Props & { onAnother: () => void }) {
  const [state, formAction, pending] = useActionState(createExpenseAction, initialState);

  // client_op_id: made ONCE per expense, in the browser. Every retry of this form (double tap, weak connection)
  // sends the same id, so the server stores the expense once (NFR-REL-01). Made after the page loads, because
  // the server's HTML and the browser's must be identical on first render.
  const [clientOpId, setClientOpId] = useState('');
  useEffect(() => {
    setClientOpId(crypto.randomUUID());
  }, []);

  if (state.saved) return <Saved expense={state.saved} phases={phases} homeHref={homeHref} onAnother={onAnother} />;

  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};
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
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={homeHref} className={styles.iconButton} aria-label={t.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{t.form.title}</h1>
          <p className={styles.subtitle}>{t.form.subtitle}</p>
        </div>
      </header>

      <div className={styles.scroll}>
        <form id={FORM_ID} action={formAction} noValidate>
          {state.formError && (
            <p role="alert" className={styles.errorSummary}>
              {state.formError}
            </p>
          )}
          <p className={styles.hint}>{t.requiredHint}</p>
          <input type="hidden" name="clientOpId" value={clientOpId} />

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
            <select
              id="phaseId"
              name="phaseId"
              className={styles.input}
              defaultValue={values.phaseId ?? phases.find((p) => p.current)?.id ?? ''}
              {...invalid('phaseId')}
            >
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
              {t.form.date}
            </label>
            <input
              id="paidOn"
              name="paidOn"
              type="date"
              max={today}
              className={styles.input}
              defaultValue={values.paidOn ?? today}
              {...invalid('paidOn')}
            />
            {errorOf('paidOn')}
          </div>
        </form>
      </div>

      {/* The button sits at the bottom of the screen (thumb reach); `form` links it to the form above.
          Disabled until the client_op_id exists, so an expense is never sent without it. */}
      <div className={styles.actions}>
        <button type="submit" form={FORM_ID} className={styles.primary} disabled={pending || clientOpId === ''}>
          {pending ? t.form.submitting : t.form.submit}
        </button>
      </div>
    </main>
  );
}

function Saved({
  expense,
  phases,
  homeHref,
  onAnother,
}: {
  expense: SavedExpense & { duplicate: boolean };
  phases: ExpensePhaseOption[];
  homeHref: string;
  onAnother: () => void;
}) {
  const phaseName = phases.find((p) => p.id === expense.phaseId)?.name;
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{t.saved.title}</h1>
        </div>
      </header>

      <div className={styles.scroll}>
        {expense.duplicate && (
          <p role="status" className={styles.info}>
            {t.saved.duplicate}
          </p>
        )}

        <div className={styles.summaryCard} role="status">
          <small>{expense.title}</small>
          <strong>
            {/* <bdi dir="ltr"> keeps the digits in the right order inside Arabic text. */}
            <bdi dir="ltr">{formatAmount(expense.amountLyd)}</bdi> {t.lyd}
          </strong>
          <p>{[expenseTypeAr[expense.expenseType], phaseName].filter(Boolean).join(' · ')}</p>
        </div>

        <div className={styles.list}>
          <div className={styles.listRow}>
            <span className={styles.rowText}>
              <strong>{t.saved.payee}</strong>
              <small>{expense.payee ?? t.saved.noPayee}</small>
            </span>
            <span className={styles.rowValue}>{dateAr(expense.paidOn)}</span>
          </div>
          <div className={styles.listRow}>
            <span className={styles.rowText}>
              <strong>{t.saved.status}</strong>
              <small>{t.saved.statusNote}</small>
            </span>
            <span className={styles.rowValue}>{t.saved.statusValue}</span>
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <Link href={homeHref} className={styles.primary}>
          {t.saved.toDashboard}
        </Link>
        <button type="button" className={styles.secondary} onClick={onAnother}>
          {t.saved.another}
        </button>
      </div>
    </main>
  );
}
