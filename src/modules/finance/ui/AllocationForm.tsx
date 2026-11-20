'use client';

// The budget plan's form: one allocation per phase (S15.2). No design screen for the form itself: built from the
// design's fields (change register). Empty = no allocation for that phase.

import Link from 'next/link';
import { useActionState } from 'react';
import { ALLOCATION_FIELD_PREFIX } from './allocation-field';
import { saveAllocationsAction, type AllocationFormState } from './budget-actions';
import { BackIcon } from './icons';
import { budgetTextAr } from './messages.ar';
import styles from './expense.module.css';

const t = budgetTextAr.form;
const FORM_ID = 'allocation-form';

interface Props {
  phases: { id: string; name: string; allocated: string | null }[];
  /** «المتاح للمراحل», formatted by the page from the domain's figure. */
  forPhases: string;
  backHref: string;
}

/** "60000.000" -> "60000" for the field. */
const plain = (v: string | null) => (v ? v.replace(/\.?0+$/, '') : '');

export function AllocationForm({ phases, forPhases, backHref }: Props) {
  const [state, formAction, pending] = useActionState(saveAllocationsAction, {} as AllocationFormState);
  const errors = state.fieldErrors ?? {};
  const value = (id: string, stored: string | null) => state.values?.[id] ?? plain(stored);

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={backHref} className={styles.iconButton} aria-label={budgetTextAr.back}>
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
          <p className={styles.hint}>{t.hint(forPhases)}</p>
          {phases.map((p) => {
            const id = `alloc-${p.id}`;
            return (
              <div key={p.id} className={styles.field}>
                <label htmlFor={id} className={styles.label}>
                  {t.phaseLabel(p.name)}
                </label>
                <input
                  id={id}
                  name={`${ALLOCATION_FIELD_PREFIX}${p.id}`}
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  autoComplete="off"
                  className={styles.input}
                  defaultValue={value(p.id, p.allocated)}
                  aria-invalid={errors[p.id] ? true : undefined}
                  aria-describedby={errors[p.id] ? `${id}-error` : undefined}
                />
                {errors[p.id] && (
                  <p id={`${id}-error`} className={styles.fieldError}>
                    {errors[p.id]}
                  </p>
                )}
              </div>
            );
          })}
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
