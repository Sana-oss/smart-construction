'use client';

// Add a price or a quote (design S24.3 «إضافة سعر»; FR-MAT-08). The design's six fields (material, unit, price, supplier,
// date, notes), plus what FR-MAT-08 asks and the design does not show: whether it is a price paid or a supplier's quote,
// the quote's validity, and the transport cost (difference recorded in the change register, 19 Nov 2026).
// Material and unit suggest the names already used, so the same material is typed the same way and grouped together.

import Link from 'next/link';
import { useActionState } from 'react';
import { PRICE_KINDS, type PriceField } from '../domain/price';
import { addPriceAction, type PriceFormState } from './price-actions';
import { BackIcon } from './icons';
import { priceTextAr } from './messages.ar';
import styles from './materials.module.css';

const t = priceTextAr.form;
const FORM_ID = 'price-form';

interface Props {
  backHref: string;
  /** Today's date in Libya, "YYYY-MM-DD": the date's default and its latest value. */
  today: string;
  /** Start on one material (from its history page, «إضافة تحديث للسعر»). */
  start?: { material: string; unit: string };
  knownMaterials: string[];
  knownUnits: string[];
}

export function PriceForm({ backHref, today, start, knownMaterials, knownUnits }: Props) {
  const [state, formAction, pending] = useActionState(addPriceAction, {} as PriceFormState);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? { material: start?.material ?? '', unit: start?.unit ?? '', kind: 'paid', recordedOn: today };
  const invalid = (name: PriceField) => ({
    'aria-invalid': errors[name] ? (true as const) : undefined,
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
  });
  const errorOf = (name: PriceField) =>
    errors[name] && (
      <p id={`${name}-error`} className={styles.fieldError}>
        {errors[name]}
      </p>
    );
  const star = <span aria-hidden="true">*</span>;
  const optional = <small className={styles.optional}>({t.optional})</small>;

  const text = (name: 'material' | 'unit' | 'supplier' | 'note', label: string, required: boolean, list?: string) => (
    <div className={styles.field}>
      <label htmlFor={name} className={styles.label}>
        {label} {required ? star : optional}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        autoComplete="off"
        list={list}
        required={required}
        className={styles.input}
        defaultValue={values[name] ?? ''}
        {...invalid(name)}
      />
      {errorOf(name)}
    </div>
  );
  const amount = (name: 'price' | 'transport', label: string, required: boolean) => (
    <div className={styles.field}>
      <label htmlFor={name} className={styles.label}>
        {label} {required ? star : optional}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        inputMode="decimal"
        dir="ltr"
        autoComplete="off"
        required={required}
        className={styles.input}
        defaultValue={values[name] ?? ''}
        {...invalid(name)}
      />
      {errorOf(name)}
    </div>
  );

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={backHref} className={styles.iconButton} aria-label={priceTextAr.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.subtitle}>{t.subtitle}</p>
        </div>
      </header>

      <div className={styles.scroll}>
        {/* key: rebuild the form with the values sent back, so the <select> keeps its choice after a refusal. */}
        <form id={FORM_ID} action={formAction} noValidate key={JSON.stringify(state.values ?? {})}>
          {state.formError && (
            <p role="alert" className={styles.errorSummary}>
              {state.formError}
            </p>
          )}
          <p className={styles.hint}>{priceTextAr.requiredHint}</p>

          {text('material', t.material, true, 'known-materials')}
          <datalist id="known-materials">
            {knownMaterials.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          {text('unit', t.unit, true, 'known-units')}
          <datalist id="known-units">
            {knownUnits.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
          {amount('price', t.price, true)}

          <div className={styles.field}>
            <label htmlFor="kind" className={styles.label}>
              {t.kind} {star}
            </label>
            <select id="kind" name="kind" required className={styles.input} defaultValue={values.kind ?? 'paid'} {...invalid('kind')}>
              {PRICE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t.kinds[k]}
                </option>
              ))}
            </select>
            {errorOf('kind')}
          </div>

          {text('supplier', t.supplier, false)}

          <div className={styles.field}>
            <label htmlFor="recordedOn" className={styles.label}>
              {t.date}
            </label>
            <input id="recordedOn" name="recordedOn" type="date" max={today} className={styles.input} defaultValue={values.recordedOn ?? today} {...invalid('recordedOn')} />
            {errorOf('recordedOn')}
          </div>

          <div className={styles.field}>
            <label htmlFor="expiresOn" className={styles.label}>
              {t.expiresOn} {optional}
            </label>
            <input id="expiresOn" name="expiresOn" type="date" className={styles.input} defaultValue={values.expiresOn ?? ''}
              aria-invalid={errors.expiresOn ? true : undefined}
              aria-describedby={errors.expiresOn ? 'expiresOn-hint expiresOn-error' : 'expiresOn-hint'}
            />
            <p id="expiresOn-hint" className={styles.hint}>
              {t.expiresOnHint}
            </p>
            {errorOf('expiresOn')}
          </div>

          {amount('transport', t.transport, false)}
          {text('note', t.note, false)}
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
