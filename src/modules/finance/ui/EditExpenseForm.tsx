'use client';

// Edit or delete one expense (owner's decision of 19 Nov 2026, change register). No design screen exists for this
// yet: it reuses the six fields of S14.1 (ExpenseFields) and the same styles, until the designer draws it.
// The database records every edit and deletion in the audit log with the old values (FR-SYS-03, migration 0016).
// Deleting asks for a second, explicit tap: the same page shows what will happen and a «نعم، احذف المصروف» button.

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { formatAmount } from '@/shared-kernel';
import type { ExpenseListItem } from '../application/list-expenses';
import { deleteExpenseAction, updateExpenseAction, type DeleteExpenseState, type ExpenseFormState } from './actions';
import { ExpenseFields } from './ExpenseFields';
import { BackIcon } from './icons';
import { expenseTextAr as t } from './messages.ar';
import styles from './expense.module.css';

const FORM_ID = 'edit-expense-form';

interface Props {
  expense: ExpenseListItem;
  phases: { id: string; name: string }[];
  /** Today's date in Libya, "YYYY-MM-DD", from the server. */
  today: string;
  /** Where the back button goes (the expenses list). */
  backHref: string;
}

export function EditExpenseForm({ expense, phases, today, backHref }: Props) {
  const [state, formAction, pending] = useActionState(updateExpenseAction, {} as ExpenseFormState);

  // The stored values first; after a refused save, what the owner typed (React resets the form).
  const values = state.values ?? {
    title: expense.title,
    amount: formatAmount(expense.amountLyd), // "12000.250" -> "12,000.25", which the form reads back as typed
    expenseType: expense.expenseType ?? '',
    phaseId: expense.phaseId ?? '',
    payee: expense.payee ?? '',
    paidOn: expense.paidOn,
  };

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={backHref} className={styles.iconButton} aria-label={t.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{t.edit.title}</h1>
          <p className={styles.subtitle}>{t.edit.subtitle}</p>
        </div>
      </header>

      <div className={styles.scroll}>
        {/* key: rebuild the form with the values sent back, so a <select> keeps its choice after a refusal. */}
        <form id={FORM_ID} action={formAction} noValidate key={JSON.stringify(state.values ?? {})}>
          {state.formError && (
            <p role="alert" className={styles.errorSummary}>
              {state.formError}
            </p>
          )}
          <p className={styles.hint}>{t.requiredHint}</p>
          <input type="hidden" name="expenseId" value={expense.id} />
          <ExpenseFields phases={phases} today={today} values={values} errors={state.fieldErrors ?? {}} dateRequired />

          <div className={styles.field}>
            <span className={styles.label}>{t.edit.receipt}</span>
            {expense.receiptUrl ? (
              <a href={expense.receiptUrl} target="_blank" rel="noopener noreferrer" className={styles.receiptLink}>
                {t.edit.receiptOpen}
              </a>
            ) : (
              <p className={styles.hint}>{t.edit.receiptNone}</p>
            )}
            {expense.receiptPath && <p className={styles.hint}>{t.edit.receiptFixed}</p>}
          </div>
        </form>

        <DeleteExpense expenseId={expense.id} />
      </div>

      <div className={styles.actions}>
        <button type="submit" form={FORM_ID} className={styles.primary} disabled={pending}>
          {pending ? t.edit.submitting : t.edit.submit}
        </button>
      </div>
    </main>
  );
}

/** Two steps: «حذف المصروف» shows what will happen; only «نعم، احذف المصروف» deletes. */
function DeleteExpense({ expenseId }: { expenseId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(deleteExpenseAction, {} as DeleteExpenseState);

  if (!confirming) {
    return (
      <button type="button" className={styles.secondary} onClick={() => setConfirming(true)}>
        {t.remove.start}
      </button>
    );
  }
  return (
    <form action={formAction} className={styles.confirmBox} aria-labelledby="delete-title" aria-describedby="delete-body">
      <strong id="delete-title">{t.remove.title}</strong>
      <p id="delete-body">{t.remove.body}</p>
      {state.formError && (
        <p role="alert" className={styles.errorSummary}>
          {state.formError}
        </p>
      )}
      <input type="hidden" name="expenseId" value={expenseId} />
      <button type="submit" className={`${styles.secondary} ${styles.danger}`} disabled={pending} autoFocus>
        {pending ? t.remove.deleting : t.remove.confirm}
      </button>
      <button type="button" className={styles.secondary} onClick={() => setConfirming(false)} disabled={pending}>
        {t.remove.cancel}
      </button>
    </form>
  );
}
