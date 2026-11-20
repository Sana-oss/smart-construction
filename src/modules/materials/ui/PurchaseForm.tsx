'use client';

// Record a purchase for one line (design S21.1 «تسجيل شراء»; FR-MAT-02). Saving makes ONE expense of qty × unit price
// (FR-FIN-03), so the owner does not record the money twice. The total is not computed here (rule R5): the expense
// shows it once saved. Over the allowed quantity, the server asks first and the owner confirms (FR-MAT-03, decision D2).
// The design's material and phase fields are the line's own: shown, not chosen.

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { BackIcon } from './icons';
import { qtyTextAr } from './messages.ar';
import styles from './materials.module.css';

const t = qtyTextAr.purchaseForm;
const FORM_ID = 'purchase-form';
type Field = 'qty' | 'unitPrice' | 'supplier' | 'purchasedOn';

export interface PurchaseFormState {
  fieldErrors?: Partial<Record<Field | 'total', string>>;
  formError?: string;
  /** Set when the purchase would pass the allowed quantity: the text of the warning to confirm. */
  overWarning?: string;
  values?: Partial<Record<Field | 'clientOpId', string>>;
}

interface Props {
  action: (prev: PurchaseFormState, form: FormData) => Promise<PurchaseFormState>;
  material: string;
  unit: string;
  phaseName: string | null;
  today: string;
  backHref: string;
}

export function PurchaseForm({ action, material, unit, phaseName, today, backHref }: Props) {
  const [state, formAction, pending] = useActionState(action, {} as PurchaseFormState);
  // One id per purchase form: a resent form (double tap, weak connection) records nothing new (NFR-REL-01).
  const [clientOpId, setClientOpId] = useState('');
  useEffect(() => {
    setClientOpId(crypto.randomUUID());
  }, []);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? { purchasedOn: today };
  const opId = state.values?.clientOpId || clientOpId;
  const star = <span aria-hidden="true">*</span>;
  const optional = <small className={styles.optional}>({qtyTextAr.optional})</small>;

  const field = (name: Field, label: string, opts: { required: boolean; numeric?: boolean; date?: boolean }) => (
    <div className={styles.field}>
      <label htmlFor={name} className={styles.label}>
        {label} {opts.required ? star : optional}
      </label>
      <input
        id={name}
        name={name}
        type={opts.date ? 'date' : 'text'}
        max={opts.date ? today : undefined}
        inputMode={opts.numeric ? 'decimal' : undefined}
        dir={opts.numeric ? 'ltr' : undefined}
        autoComplete="off"
        className={styles.input}
        defaultValue={values[name] ?? ''}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={errors[name] ? `${name}-error` : undefined}
      />
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
          {errors.total && (
            <p role="alert" className={styles.errorSummary}>
              {errors.total}
            </p>
          )}
          <input type="hidden" name="clientOpId" value={opId} />
          <ul className={styles.list} aria-label={t.material}>
            <li className={styles.listRow}>
              <span className={styles.rowText}>
                <strong>{t.material}</strong>
                <small>{material}</small>
              </span>
            </li>
            <li className={styles.listRow}>
              <span className={styles.rowText}>
                <strong>{t.phase}</strong>
                <small>{phaseName ?? t.noPhase}</small>
              </span>
            </li>
          </ul>
          <p className={styles.hint}>{qtyTextAr.requiredHint}</p>
          {field('qty', t.qty(unit), { required: true, numeric: true })}
          {field('unitPrice', t.unitPrice(unit), { required: true, numeric: true })}
          {field('supplier', t.supplier, { required: false })}
          {field('purchasedOn', t.date, { required: false, date: true })}
          {state.overWarning && (
            <div className={styles.confirmBox} role="alert">
              <p>{state.overWarning}</p>
              <label>
                <input type="checkbox" name="overConfirmed" value="yes" /> {t.overConfirm}
              </label>
            </div>
          )}
          <p className={styles.hint}>{t.linkNote}</p>
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
