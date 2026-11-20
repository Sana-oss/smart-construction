'use client';

// Recording the check of one item (design S26.2 «تفاصيل بند الفحص»; FR-QLT-01): the result, a note, who fixes it and
// when it is checked again. Who checked and when are set by the database (0025). The design's «تسجيل عيب مرتبط» waits
// for the defects list (3.17); the photo comes in slice 2.

import Link from 'next/link';
import { useActionState } from 'react';
import type { ChecklistItemRecord } from '../application/checklists';
import { CHECK_RESULTS, type CheckField } from '../domain/checklist';
import type { CheckState } from './checklist-actions';
import { BackIcon } from './icons';
import { checklistTextAr } from './messages.ar';
import styles from './quality.module.css';

const t = checklistTextAr.item;
const FORM_ID = 'check-form';

interface Props {
  action: (prev: CheckState, form: FormData) => Promise<CheckState>;
  item: ChecklistItemRecord;
  checklistTitle: string;
  backHref: string;
}

export function CheckItemForm({ action, item, checklistTitle, backHref }: Props) {
  const [state, formAction, pending] = useActionState(action, {} as CheckState);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {
    result: item.result ?? '',
    note: item.note ?? '',
    responsible: item.responsible ?? '',
    recheckOn: item.recheckOn ?? '',
  };
  const optional = <small className={styles.optional}>({checklistTextAr.optional})</small>;
  const errorOf = (name: CheckField) =>
    errors[name] && (
      <p id={`${name}-error`} className={styles.fieldError}>
        {errors[name]}
      </p>
    );
  const text = (name: 'note' | 'responsible', label: string, hint?: string) => (
    <div className={styles.field}>
      <label htmlFor={name} className={styles.label}>
        {label} {optional}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        autoComplete="off"
        className={styles.input}
        defaultValue={values[name] ?? ''}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={[errors[name] && `${name}-error`, hint && `${name}-hint`].filter(Boolean).join(' ') || undefined}
      />
      {hint && (
        <p id={`${name}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
      {errorOf(name)}
    </div>
  );

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={backHref} className={styles.iconButton} aria-label={checklistTextAr.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{item.text}</h1>
          <p className={styles.subtitle}>
            {t.title} · {checklistTitle}
          </p>
        </div>
      </header>

      <div className={styles.scroll}>
        <form id={FORM_ID} action={formAction} noValidate key={JSON.stringify(state.values ?? {})}>
          {state.formError && (
            <p role="alert" className={styles.errorSummary}>
              {state.formError}
            </p>
          )}
          <fieldset className={styles.field} aria-describedby={errors.result ? 'result-error' : undefined}>
            <legend className={styles.label}>
              {t.result} <span aria-hidden="true">*</span>
            </legend>
            {CHECK_RESULTS.map((r) => (
              <label key={r} className={styles.choice}>
                <input type="radio" name="result" value={r} defaultChecked={values.result === r} />
                <span>{checklistTextAr.result[r]}</span>
              </label>
            ))}
            {errorOf('result')}
          </fieldset>
          {text('note', t.note)}
          {text('responsible', t.responsible, t.responsibleHint)}
          <div className={styles.field}>
            <label htmlFor="recheckOn" className={styles.label}>
              {t.recheckOn} {optional}
            </label>
            <input
              id="recheckOn"
              name="recheckOn"
              type="date"
              className={styles.input}
              defaultValue={values.recheckOn ?? ''}
              aria-invalid={errors.recheckOn ? true : undefined}
              aria-describedby={errors.recheckOn ? 'recheckOn-error' : undefined}
            />
            {errorOf('recheckOn')}
          </div>
          <p className={styles.hint}>{checklistTextAr.engineerNote}</p>
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
