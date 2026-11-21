'use client';

// Confirm the payment of an installment (FR-FIN-09; design S17.3 «تأكيد التحويل»): date and expense type. When the
// installment is not due, the form says what is missing and asks for a tick (D2: warn, never block). The Server Action
// comes from the page (src/app), because the due state needs the phase and its photos (other modules).

import { useActionState } from 'react';
import { EXPENSE_TYPES } from '../domain/expense';
import type { DueGap } from '../domain/payments';
import { expenseTypeAr, settleTextAr } from './messages.ar';
import type { PayFormState } from './settle-form-state';
import styles from './expense.module.css';

const t = settleTextAr.payForm;

interface Props {
  action: (prev: PayFormState, form: FormData) => Promise<PayFormState>;
  today: string;
  /** What is missing; null when the installment is due or not tied to a phase. */
  gaps: readonly DueGap[] | null;
  /** The money that leaves now (amount minus the retained part), already formatted. */
  cash: string;
}

export function PayForm({ action, today, gaps, cash }: Props) {
  const [state, formAction, pending] = useActionState(action, {} as PayFormState);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};
  return (
    <form action={formAction} noValidate className={styles.info} key={JSON.stringify(state.values ?? {})}>
      <h2 className={styles.label}>{t.title}</h2>
      {state.formError && (
        <p role="alert" className={styles.errorSummary}>
          {state.formError}
        </p>
      )}
      <p className={styles.hint}>{settleTextAr.paidNow(cash)}</p>

      <div className={styles.field}>
        <label htmlFor="paidOn" className={styles.label}>
          {t.date}
        </label>
        <input id="paidOn" name="paidOn" type="date" max={today} className={styles.input} defaultValue={values.paidOn ?? today} aria-invalid={errors.paidOn ? true : undefined} />
        {errors.paidOn && <p className={styles.fieldError}>{errors.paidOn}</p>}
      </div>

      <div className={styles.field}>
        <label htmlFor="expenseType" className={styles.label}>
          {t.type}
        </label>
        <select id="expenseType" name="expenseType" className={styles.input} defaultValue={values.expenseType ?? 'labor'}>
          {EXPENSE_TYPES.map((type) => (
            <option key={type} value={type}>
              {expenseTypeAr[type]}
            </option>
          ))}
        </select>
        <p className={styles.hint}>{t.typeHint}</p>
        {errors.expenseType && <p className={styles.fieldError}>{errors.expenseType}</p>}
      </div>

      {gaps && (
        <div role="note" className={styles.confirmBox}>
          <strong>{t.notDueTitle}</strong>
          <ul>
            {gaps.map((g) => (
              <li key={g}>{settleTextAr.gap[g]}</li>
            ))}
          </ul>
          <p>{t.notDueNote}</p>
          <label className={styles.checkRow}>
            <input type="checkbox" name="confirmed" value="yes" />
            <span>{t.confirm}</span>
          </label>
          {state.needsConfirm && (
            <p role="alert" className={styles.fieldError}>
              {t.needsConfirm}
            </p>
          )}
        </div>
      )}

      <button type="submit" className={styles.primary} disabled={pending}>
        {pending ? t.submitting : t.submit}
      </button>
    </form>
  );
}
