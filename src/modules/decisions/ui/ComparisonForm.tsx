'use client';

// The owner's figures for the three scenarios (no design screen yet: built from the design's fields and styles, change
// register 20 Nov 2026). Every field is optional: what is left empty shows as «ناقص» in S18.1 (FR-DEC-03). The system
// never suggests a cost: protection, storage and restart are the owner's (or their engineer's) estimates.

import Link from 'next/link';
import { useActionState } from 'react';
import type { StoredComparison } from '../application/comparison';
import type { ComparisonField } from '../domain/scenarios';
import { saveComparisonAction, type ComparisonFormState } from './actions';
import { BackIcon } from './icons';
import { decisionTextAr } from './messages.ar';
import styles from './decisions.module.css';

const t = decisionTextAr.form;
const FORM_ID = 'comparison-form';
/** "200000.000" -> "200000" for the form (the stored value is canonical). */
const plain = (v: string | null | undefined) => (v ? v.replace(/\.?0+$/, '') : '');

interface Props {
  stored: StoredComparison['inputs'] | null;
  phases: { id: string; name: string }[];
  backHref: string;
}

export function ComparisonForm({ stored, phases, backHref }: Props) {
  const [state, formAction, pending] = useActionState(saveComparisonAction, {} as ComparisonFormState);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {
    remainingWorks: plain(stored?.remainingWorks),
    materialsOnHand: plain(stored?.materialsOnHand),
    phaseId: stored?.phaseId ?? '',
    phaseCost: plain(stored?.phaseCost),
    protection: plain(stored?.protection),
    storage: plain(stored?.storage),
    restart: plain(stored?.restart),
    priceChangePct: stored?.priceChangePct ?? '0',
  };
  const describe = (name: ComparisonField, hint?: boolean) => {
    const ids = [hint ? `${name}-hint` : null, errors[name] ? `${name}-error` : null].filter(Boolean).join(' ');
    return { 'aria-invalid': errors[name] ? (true as const) : undefined, 'aria-describedby': ids || undefined };
  };
  const errorOf = (name: ComparisonField) =>
    errors[name] && (
      <p id={`${name}-error`} className={styles.fieldError}>
        {errors[name]}
      </p>
    );
  const amount = (name: ComparisonField, label: string, hint?: string) => (
    <div className={styles.field}>
      <label htmlFor={name} className={styles.label}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        inputMode="decimal"
        dir="ltr"
        autoComplete="off"
        className={styles.input}
        defaultValue={values[name as keyof typeof values] ?? ''}
        {...describe(name, Boolean(hint))}
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
        <Link href={backHref} className={styles.iconButton} aria-label={decisionTextAr.back}>
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
          {amount('remainingWorks', t.remainingWorks, t.remainingWorksHint)}
          {amount('materialsOnHand', t.materialsOnHand, t.materialsOnHandHint)}

          <div className={styles.field}>
            <label htmlFor="phaseId" className={styles.label}>
              {t.phase}
            </label>
            <select id="phaseId" name="phaseId" className={styles.input} defaultValue={values.phaseId ?? ''} {...describe('phaseId')}>
              <option value="">{t.noPhase}</option>
              {phases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {errorOf('phaseId')}
          </div>
          {amount('phaseCost', t.phaseCost)}

          <p className={styles.label}>{t.pauseGroup}</p>
          <p className={styles.hint}>{t.pauseHint}</p>
          {amount('protection', t.protection)}
          {amount('storage', t.storage)}
          {amount('restart', t.restart)}

          {amount('priceChangePct', t.priceChangePct, t.priceChangeHint)}
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
