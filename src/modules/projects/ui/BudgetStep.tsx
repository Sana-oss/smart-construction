'use client';

// Step 3 of the wizard: budget (FR-FIN-01). Design: S02.3, plus the contingency field (decision 11).
// Amounts accept Arabic digits and thousands separators ("٤٥٠٬٠٠٠", "450,000"). Spending more than the budget is
// a warning, not an error (decision D2): the owner confirms it on the review step.

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { validateBudget, type SetupField } from '../domain/project-setup';
import { toFieldErrors } from './field-errors';
import { wizardTextAr } from './messages.ar';
import { SETUP_PHASES_PATH, SETUP_REVIEW_PATH } from './routes';
import { useWizardDraft } from './use-wizard-draft';
import { WizardShell } from './WizardShell';
import styles from './wizard.module.css';

const t = wizardTextAr.budget;
type BudgetField = 'totalBudget' | 'availableNow' | 'spentBefore' | 'contingencyPct';

export function BudgetStep() {
  const router = useRouter();
  const { draft, update } = useWizardDraft();
  const [errors, setErrors] = useState<Partial<Record<SetupField, string>>>({});
  if (!draft) return null;

  const check = validateBudget(draft);
  const overBudget = check.ok && check.value.overBudget;

  const next = () => {
    if (!check.ok) {
      setErrors(toFieldErrors(check.errors));
      return;
    }
    router.push(SETUP_REVIEW_PATH);
  };

  const field = (name: BudgetField, label: string, helper?: string) => (
    <div className={styles.field}>
      <label htmlFor={name} className={styles.label}>
        {label} <span aria-hidden="true">*</span>
      </label>
      <input
        id={name}
        type="text"
        inputMode="decimal"
        dir="ltr"
        autoComplete="off"
        className={styles.input}
        value={draft[name] ?? ''}
        onChange={(e) => update({ [name]: e.target.value })}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={[errors[name] ? `${name}-error` : '', helper ? `${name}-helper` : ''].filter(Boolean).join(' ') || undefined}
        required
      />
      {helper && (
        <p id={`${name}-helper`} className={styles.helper}>
          {helper}
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
    <WizardShell
      step={3}
      title={t.title}
      subtitle={t.subtitle}
      backHref={SETUP_PHASES_PATH}
      actions={
        <button type="button" className={styles.primary} onClick={next}>
          {t.next}
        </button>
      }
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          next();
        }}
      >
        <p className={styles.hint}>{wizardTextAr.requiredHint}</p>
        {field('totalBudget', t.total)}
        {field('availableNow', t.availableNow, t.availableHelper)}
        {field('spentBefore', t.spentBefore)}
        {field('contingencyPct', t.contingency, t.contingencyHelper)}
      </form>
      {overBudget && (
        <p role="status" className={styles.warning}>
          {t.overBudget}
        </p>
      )}
    </WizardShell>
  );
}
