'use client';

// Add an extra work or change (FR-FIN-10): description, value, date, phase, status, note. No design screen: built from
// the design's form fields (change register).

import Link from 'next/link';
import { useActionState } from 'react';
import { EXTRA_STATUSES, type ExtraField } from '../domain/extras';
import { addExtraAction, type ExtraFormState } from './extra-actions';
import { BackIcon } from './icons';
import { expenseTextAr, extrasTextAr } from './messages.ar';
import styles from './expense.module.css';

const t = extrasTextAr.form;
const FORM_ID = 'extra-form';

export function ExtraForm({ phases, today, backHref }: { phases: { id: string; name: string }[]; today: string; backHref: string }) {
  const [state, formAction, pending] = useActionState(addExtraAction, {} as ExtraFormState);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? { occurredOn: today, status: 'proposed' };
  const invalid = (name: ExtraField) => ({
    'aria-invalid': errors[name] ? (true as const) : undefined,
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
  });
  const errorOf = (name: ExtraField) =>
    errors[name] && (
      <p id={`${name}-error`} className={styles.fieldError}>
        {errors[name]}
      </p>
    );
  const star = <span aria-hidden="true">*</span>;

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={backHref} className={styles.iconButton} aria-label={extrasTextAr.back}>
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
            <label htmlFor="title" className={styles.label}>
              {t.titleLabel} {star}
            </label>
            <input id="title" name="title" type="text" autoComplete="off" className={styles.input} defaultValue={values.title ?? ''} {...invalid('title')} />
            {errorOf('title')}
          </div>

          <div className={styles.field}>
            <label htmlFor="cost" className={styles.label}>
              {t.cost} {star}
            </label>
            <input id="cost" name="cost" type="text" inputMode="decimal" dir="ltr" autoComplete="off" className={styles.input} defaultValue={values.cost ?? ''} {...invalid('cost')} />
            {errorOf('cost')}
          </div>

          <div className={styles.field}>
            <label htmlFor="status" className={styles.label}>
              {t.status}
            </label>
            <select id="status" name="status" className={styles.input} defaultValue={values.status ?? 'proposed'} {...invalid('status')}>
              {EXTRA_STATUSES.filter((s) => s !== 'rejected').map((s) => (
                <option key={s} value={s}>
                  {extrasTextAr.status[s]}
                </option>
              ))}
            </select>
            {errorOf('status')}
          </div>

          <div className={styles.field}>
            <label htmlFor="phaseId" className={styles.label}>
              {t.phase}
            </label>
            <select id="phaseId" name="phaseId" className={styles.input} defaultValue={values.phaseId ?? ''} {...invalid('phaseId')}>
              <option value="">{t.noPhase}</option>
              {phases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {errorOf('phaseId')}
          </div>

          <div className={styles.field}>
            <label htmlFor="occurredOn" className={styles.label}>
              {t.date}
            </label>
            <input id="occurredOn" name="occurredOn" type="date" max={today} className={styles.input} defaultValue={values.occurredOn ?? today} {...invalid('occurredOn')} />
            {errorOf('occurredOn')}
          </div>

          <div className={styles.field}>
            <label htmlFor="note" className={styles.label}>
              {t.note} <small className={styles.optional}>({t.optional})</small>
            </label>
            <input id="note" name="note" type="text" autoComplete="off" className={styles.input} defaultValue={values.note ?? ''} {...invalid('note')} />
            {errorOf('note')}
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
