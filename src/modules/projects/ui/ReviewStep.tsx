'use client';

// Step 4 (last) of the wizard: review and create (FR-PRJ-01). Design: S02.5 "مشروعك جاهز".
// Additions decided 14 Nov: the add-a-floor safety notice (FR-PRJ-02, decision 9) and the over-budget
// confirmation (decision D2 / 7). The "project team" row shows only the owner (S02.4 deferred).

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { formatAmount } from '@/shared-kernel';
import type { TemplatePhase } from '../application/project-gateway';
import { validateBudget, validateProjectDetails } from '../domain/project-setup';
import { createFirstProjectAction } from './actions';
import { LayersIcon, UsersIcon, WalletIcon } from './icons';
import { wizardTextAr } from './messages.ar';
import { PROJECT_HOME_PATH, SETUP_BUDGET_PATH, SETUP_DETAILS_PATH } from './routes';
import { useWizardDraft } from './use-wizard-draft';
import { WizardShell } from './WizardShell';
import styles from './wizard.module.css';

const t = wizardTextAr.review;

export function ReviewStep({ template }: { template: TemplatePhase[] }) {
  const router = useRouter();
  const { draft, update, clear } = useWizardDraft();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (!draft) return null;

  const details = validateProjectDetails(draft);
  const budget = validateBudget(draft);
  const current = template.find((p) => p.position === draft.currentPhase);
  const complete = details.ok && budget.ok && current !== undefined;
  const overBudget = budget.ok && budget.value.overBudget;

  const create = () =>
    startTransition(async () => {
      setMessage(null);
      const result = await createFirstProjectAction(draft);
      if (result.ok || result.alreadyHasProject) {
        clear();
        router.replace(PROJECT_HOME_PATH);
        router.refresh();
        return;
      }
      setMessage(result.message);
    });

  return (
    <WizardShell
      step={4}
      title={t.title}
      subtitle={t.subtitle}
      backHref={SETUP_BUDGET_PATH}
      actions={
        <>
          <button
            type="button"
            className={styles.primary}
            onClick={create}
            disabled={pending || !complete || (overBudget && !draft.overBudgetConfirmed)}
          >
            {pending ? t.creating : t.create}
          </button>
          <button type="button" className={styles.secondary} onClick={() => router.push(SETUP_DETAILS_PATH)}>
            {t.edit}
          </button>
        </>
      }
    >
      {message && (
        <p role="alert" className={styles.errorSummary}>
          {message}
        </p>
      )}
      {!complete && <p className={styles.warning}>{t.incomplete}</p>}

      {details.ok && (
        <div className={styles.summaryCard}>
          <small>{t.projectName}</small>
          <strong>{details.value.name}</strong>
          <p>
            {details.value.city} · {t.area(formatAmount(details.value.buildingAreaM2))}
          </p>
        </div>
      )}

      <div className={styles.list}>
        <div className={styles.listRow}>
          <span className={styles.rowIcon}>
            <LayersIcon />
          </span>
          <span className={styles.rowText}>
            <strong>{t.currentPhase}</strong>
            <small>{current?.name ?? '—'}</small>
          </span>
          <span className={styles.rowValue}>{current ? t.phaseOf(current.position, template.length) : '—'}</span>
        </div>
        <div className={styles.listRow}>
          <span className={styles.rowIcon}>
            <WalletIcon />
          </span>
          <span className={styles.rowText}>
            <strong>{t.totalBudget}</strong>
            <small>{t.inLyd}</small>
          </span>
          <span className={styles.rowValue}>{budget.ok ? formatAmount(budget.value.totalBudget) : '—'}</span>
        </div>
        <div className={styles.listRow}>
          <span className={styles.rowIcon}>
            <UsersIcon />
          </span>
          <span className={styles.rowText}>
            <strong>{t.team}</strong>
            <small>{t.teamLater}</small>
          </span>
          <span className={styles.rowValue}>{t.teamOwner}</span>
        </div>
      </div>

      {details.ok && details.value.projectType === 'add_floor' && (
        <p role="note" className={styles.warning}>
          {t.addFloorWarning}
        </p>
      )}

      {overBudget && (
        <div className={styles.warning}>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={draft.overBudgetConfirmed === true}
              onChange={(e) => update({ overBudgetConfirmed: e.target.checked })}
            />
            <span>{t.overBudgetConfirm}</span>
          </label>
        </div>
      )}
    </WizardShell>
  );
}
