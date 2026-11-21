'use client';

// Add a payment to a contract's schedule (FR-FIN-09): name, amount, the phase it falls due after, and the retained part
// the owner typed (D9: never suggested). No design screen: built from the design's form fields (change register).

import Link from 'next/link';
import { useActionState } from 'react';
import type { PaymentField } from '../domain/contracts';
import { addPaymentAction, type PaymentFormState } from './contract-actions';
import { BackIcon } from './icons';
import { contractsTextAr, expenseTextAr } from './messages.ar';
import styles from './expense.module.css';

const t = contractsTextAr.paymentForm;
const FORM_ID = 'payment-form';

interface Props {
  contractId: string;
  contractTitle: string;
  phases: { id: string; name: string }[];
  backHref: string;
}

export function PaymentForm({ contractId, contractTitle, phases, backHref }: Props) {
  const [state, formAction, pending] = useActionState(addPaymentAction.bind(null, contractId), {} as PaymentFormState);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};
  const invalid = (name: PaymentField) => ({
    'aria-invalid': errors[name] ? (true as const) : undefined,
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
  });
  const errorOf = (name: PaymentField) =>
    errors[name] && (
      <p id={`${name}-error`} className={styles.fieldError}>
        {errors[name]}
      </p>
    );
  const star = <span aria-hidden="true">*</span>;

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={backHref} className={styles.iconButton} aria-label={contractsTextAr.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.subtitle}>{t.subtitle(contractTitle)}</p>
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
            <input id="title" name="title" type="text" autoComplete="off" placeholder={t.titleHint} className={styles.input} defaultValue={values.title ?? ''} {...invalid('title')} />
            {errorOf('title')}
          </div>

          <div className={styles.field}>
            <label htmlFor="amount" className={styles.label}>
              {t.amount} {star}
            </label>
            <input id="amount" name="amount" type="text" inputMode="decimal" dir="ltr" autoComplete="off" className={styles.input} defaultValue={values.amount ?? ''} {...invalid('amount')} />
            {errorOf('amount')}
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
            <label htmlFor="retained" className={styles.label}>
              {t.retained} <small className={styles.optional}>({contractsTextAr.optional})</small>
            </label>
            <input id="retained" name="retained" type="text" inputMode="decimal" dir="ltr" autoComplete="off" className={styles.input} defaultValue={values.retained ?? ''} {...invalid('retained')} />
            <p className={styles.hint}>{t.retainedHint}</p>
            {errorOf('retained')}
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
