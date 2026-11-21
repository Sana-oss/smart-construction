'use client';

// Add or edit a contract (FR-FIN-08; editing: 3.16 deepening, owner's decision of 21 Nov 2026): title, contractor, value, scope, cleanup clause (FR-FIN-12), contract copy. No design
// screen: built from the design's form fields (change register). The Server Action comes from the page (src/app),
// because it checks the contract copy, a document of another module.

import Link from 'next/link';
import { useActionState } from 'react';
import type { ContractField } from '../domain/contracts';
import { CONTRACT_FORM_FIELDS, type ContractFormState } from './contract-form-state';
import { BackIcon } from './icons';
import { contractsTextAr, expenseTextAr } from './messages.ar';
import styles from './expense.module.css';

const FORM_ID = 'contract-form';

interface Props {
  action: (prev: ContractFormState, form: FormData) => Promise<ContractFormState>;
  /** The project's documents of type «عقد», to choose the contract copy from. */
  copies: { id: string; title: string }[];
  backHref: string;
  /** 'edit' shows the saved values and the editing texts; the Server Action (from the page) then updates the contract. */
  mode?: 'add' | 'edit';
  initial?: Partial<Record<(typeof CONTRACT_FORM_FIELDS)[number], string>>;
}

export function ContractForm({ action, copies, backHref, mode = 'add', initial }: Props) {
  const t = mode === 'edit' ? contractsTextAr.editForm : contractsTextAr.form;
  const [state, formAction, pending] = useActionState(action, {} as ContractFormState);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? initial ?? {};
  const invalid = (name: ContractField) => ({
    'aria-invalid': errors[name] ? (true as const) : undefined,
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
  });
  const errorOf = (name: ContractField) =>
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
            <input id="title" name="title" type="text" autoComplete="off" placeholder={t.titleHint} className={styles.input} defaultValue={values.title ?? ''} {...invalid('title')} />
            {errorOf('title')}
          </div>

          <div className={styles.field}>
            <label htmlFor="contractor" className={styles.label}>
              {t.contractor} {star}
            </label>
            <input id="contractor" name="contractor" type="text" autoComplete="off" className={styles.input} defaultValue={values.contractor ?? ''} {...invalid('contractor')} />
            {errorOf('contractor')}
          </div>

          <div className={styles.field}>
            <label htmlFor="value" className={styles.label}>
              {t.value} {star}
            </label>
            <input id="value" name="value" type="text" inputMode="decimal" dir="ltr" autoComplete="off" className={styles.input} defaultValue={values.value ?? ''} {...invalid('value')} />
            {errorOf('value')}
          </div>

          <div className={styles.field}>
            <label htmlFor="scope" className={styles.label}>
              {t.scope} <small className={styles.optional}>({contractsTextAr.optional})</small>
            </label>
            <input id="scope" name="scope" type="text" autoComplete="off" className={styles.input} defaultValue={values.scope ?? ''} {...invalid('scope')} />
            {errorOf('scope')}
          </div>

          <div className={styles.field}>
            <label htmlFor="cleanupClause" className={styles.label}>
              {t.cleanup} <small className={styles.optional}>({contractsTextAr.optional})</small>
            </label>
            <input id="cleanupClause" name="cleanupClause" type="text" autoComplete="off" placeholder={t.cleanupHint} className={styles.input} defaultValue={values.cleanupClause ?? ''} {...invalid('cleanupClause')} />
            {errorOf('cleanupClause')}
          </div>

          <div className={styles.field}>
            <label htmlFor="documentId" className={styles.label}>
              {t.copy} <small className={styles.optional}>({contractsTextAr.optional})</small>
            </label>
            <select id="documentId" name="documentId" className={styles.input} defaultValue={values.documentId ?? ''} {...invalid('documentId')}>
              <option value="">{t.noCopy}</option>
              {copies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <p className={styles.hint}>{t.copyHint}</p>
            {errorOf('documentId')}
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
