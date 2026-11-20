'use client';

// Record a pour (design S27.2 «تسجيل صبة»; FR-QLT-04): the element, date, supplier, quantity, cube samples, the design's
// mix reference and delivery note, the phase, and the engineer's two dates (FR-QLT-05), copied by the owner. One id per
// form (0002's client_op_id): a resent form records nothing new.

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import type { PourField } from '../domain/concrete';
import { addPourAction, type PourFormState } from './concrete-actions';
import { BackIcon } from './icons';
import { concreteTextAr } from './messages.ar';
import styles from './quality.module.css';

const t = concreteTextAr.form;
const FORM_ID = 'pour-form';

interface Props {
  phases: { id: string; name: string }[];
  phaseId: string | null;
  today: string;
  backHref: string;
}

export function PourForm({ phases, phaseId, today, backHref }: Props) {
  const [state, formAction, pending] = useActionState(addPourAction, {} as PourFormState);
  const [clientOpId, setClientOpId] = useState('');
  useEffect(() => {
    setClientOpId(crypto.randomUUID());
  }, []);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? { pouredOn: today, phaseId: phaseId ?? '' };
  const opId = state.values?.clientOpId || clientOpId;
  const star = <span aria-hidden="true">*</span>;
  const optional = <small className={styles.optional}>({concreteTextAr.optional})</small>;

  const field = (
    name: Exclude<PourField, 'phaseId' | 'clientOpId'>,
    label: string,
    opts: { required?: boolean; type?: 'text' | 'date'; numeric?: boolean; max?: string; hint?: string } = {},
  ) => (
    <div className={styles.field}>
      <label htmlFor={name} className={styles.label}>
        {label} {opts.required ? star : optional}
      </label>
      <input
        id={name}
        name={name}
        type={opts.type ?? 'text'}
        max={opts.max}
        inputMode={opts.numeric ? 'decimal' : undefined}
        dir={opts.numeric ? 'ltr' : undefined}
        autoComplete="off"
        className={styles.input}
        defaultValue={values[name] ?? ''}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={[errors[name] && `${name}-error`, opts.hint && `${name}-hint`].filter(Boolean).join(' ') || undefined}
      />
      {opts.hint && (
        <p id={`${name}-hint`} className={styles.hint}>
          {opts.hint}
        </p>
      )}
      {errors[name] && (
        <p id={`${name}-error`} className={styles.fieldError}>
          {errors[name]}
        </p>
      )}
    </div>
  );

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={backHref} className={styles.iconButton} aria-label={concreteTextAr.back}>
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
          <input type="hidden" name="clientOpId" value={opId} />
          <p className={styles.hint}>{concreteTextAr.requiredHint}</p>
          {field('element', t.element, { required: true, hint: t.elementHint })}
          {field('pouredOn', t.pouredOn, { required: true, type: 'date', max: today })}
          {field('supplier', t.supplier, { required: true })}
          {field('qtyM3', t.qtyM3, { required: true, numeric: true })}
          {field('cubeSamples', t.cubeSamples, { numeric: true })}
          {field('mixRef', t.mixRef, { hint: t.mixRefHint })}
          {field('deliveryRef', t.deliveryRef)}
          <div className={styles.field}>
            <label htmlFor="phaseId" className={styles.label}>
              {t.phase} {optional}
            </label>
            <select id="phaseId" name="phaseId" className={styles.input} defaultValue={values.phaseId ?? ''}>
              <option value="">{t.noPhase}</option>
              {phases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {errors.phaseId && <p className={styles.fieldError}>{errors.phaseId}</p>}
          </div>

          <p className={styles.label}>{t.engineerGroup}</p>
          <p className={styles.hint}>{t.engineerHint}</p>
          {field('curingUntil', t.curingUntil, { type: 'date' })}
          {field('formworkOn', t.formworkOn, { type: 'date' })}
          {field('note', t.note)}
          <p className={styles.hint}>{t.docsNote}</p>
        </form>
      </div>

      <div className={styles.actions}>
        <button type="submit" form={FORM_ID} className={styles.primary} disabled={pending || opId === ''}>
          {pending ? t.submitting : t.submit}
        </button>
      </div>
    </main>
  );
}
