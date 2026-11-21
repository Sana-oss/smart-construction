'use client';

// Release the retained part of a paid installment (FR-FIN-09): date and expense type. Allowed at any time; while a phase
// is not done the form says so and asks for a tick (D2). The Server Action comes from the page (src/app).

import { useActionState } from 'react';
import { EXPENSE_TYPES } from '../domain/expense';
import { expenseTypeAr, settleTextAr } from './messages.ar';
import type { ReleaseFormState } from './settle-form-state';
import styles from './expense.module.css';

const t = settleTextAr.releaseForm;

interface Props {
  action: (prev: ReleaseFormState, form: FormData) => Promise<ReleaseFormState>;
  today: string;
  /** The retained amount, already formatted. */
  retained: string;
  allPhasesDone: boolean;
}

export function ReleaseForm({ action, today, retained, allPhasesDone }: Props) {
  const [state, formAction, pending] = useActionState(action, {} as ReleaseFormState);
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
      <p className={styles.hint}>{t.note(retained)}</p>

      <div className={styles.field}>
        <label htmlFor="releasedOn" className={styles.label}>
          {t.date}
        </label>
        <input id="releasedOn" name="releasedOn" type="date" max={today} className={styles.input} defaultValue={values.releasedOn ?? today} aria-invalid={errors.releasedOn ? true : undefined} />
        {errors.releasedOn && <p className={styles.fieldError}>{errors.releasedOn}</p>}
      </div>

      <div className={styles.field}>
        <label htmlFor="releaseType" className={styles.label}>
          {t.type}
        </label>
        <select id="releaseType" name="expenseType" className={styles.input} defaultValue={values.expenseType ?? 'labor'}>
          {EXPENSE_TYPES.map((type) => (
            <option key={type} value={type}>
              {expenseTypeAr[type]}
            </option>
          ))}
        </select>
        {errors.expenseType && <p className={styles.fieldError}>{errors.expenseType}</p>}
      </div>

      {!allPhasesDone && (
        <div role="note" className={styles.confirmBox}>
          <strong>{t.notDoneTitle}</strong>
          <p>{t.notDoneNote}</p>
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
