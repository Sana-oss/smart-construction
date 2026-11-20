'use client';

// Add a line to the quantity table (FR-MAT-01): what the requirement lists, typed once from the engineer's bill of
// quantities. No design screen for this form: built from the design's form fields (change register).

import Link from 'next/link';
import { useActionState } from 'react';
import type { ItemField } from '../domain/quantities';
import { BackIcon } from './icons';
import { qtyTextAr } from './messages.ar';
import { addItemAction, type ItemFormState } from './quantity-actions';
import styles from './materials.module.css';

const t = qtyTextAr.itemForm;
const FORM_ID = 'item-form';

export function ItemForm({ phases, backHref }: { phases: { id: string; name: string }[]; backHref: string }) {
  const [state, formAction, pending] = useActionState(addItemAction, {} as ItemFormState);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};
  const star = <span aria-hidden="true">*</span>;
  const optional = <small className={styles.optional}>({qtyTextAr.optional})</small>;
  const describedBy = (name: ItemField, hint: boolean) =>
    [errors[name] && `${name}-error`, hint && `${name}-hint`].filter(Boolean).join(' ') || undefined;
  const after = (name: ItemField, hint?: string) => (
    <>
      {hint && (
        <p id={`${name}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
      {errors[name] && (
        <p id={`${name}-error`} className={styles.fieldError}>
          {errors[name]}
        </p>
      )}
    </>
  );
  const input = (name: Exclude<ItemField, 'phaseId'>, label: string, opts: { required: boolean; numeric?: boolean; hint?: string }) => (
    <div className={styles.field}>
      <label htmlFor={name} className={styles.label}>
        {label} {opts.required ? star : optional}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        inputMode={opts.numeric ? 'decimal' : undefined}
        dir={opts.numeric ? 'ltr' : undefined}
        autoComplete="off"
        className={styles.input}
        defaultValue={values[name] ?? ''}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={describedBy(name, Boolean(opts.hint))}
      />
      {after(name, opts.hint)}
    </div>
  );

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={backHref} className={styles.iconButton} aria-label={qtyTextAr.back}>
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
          <p className={styles.hint}>{qtyTextAr.requiredHint}</p>
          {input('material', t.material, { required: true })}
          {input('unit', t.unit, { required: true, hint: t.unitHint })}
          {input('plannedQty', t.plannedQty, { required: true, numeric: true })}
          {input('wastePct', t.wastePct, { required: false, numeric: true, hint: t.wasteHint })}
          <div className={styles.field}>
            <label htmlFor="phaseId" className={styles.label}>
              {t.phase} {optional}
            </label>
            <select
              id="phaseId"
              name="phaseId"
              className={styles.input}
              defaultValue={values.phaseId ?? ''}
              aria-invalid={errors.phaseId ? true : undefined}
              aria-describedby={describedBy('phaseId', false)}
            >
              <option value="">{t.noPhase}</option>
              {phases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {after('phaseId')}
          </div>
          {input('source', t.source, { required: false, hint: t.sourceHint })}
          {input('verifiedBy', t.verifiedBy, { required: false })}
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
