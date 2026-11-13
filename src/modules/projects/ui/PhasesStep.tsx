'use client';

// Step 2 of the wizard: choose the current phase (FR-PRJ-01 "current phase", FR-PRJ-03). Design: S02.2.
// Phases before the chosen one show "مكتملة", the chosen one "الحالية", later ones "لاحقًا" (decision 5).
// Renaming, reordering and dates come with the phases screen (S09) — decision 16.

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { TemplatePhase } from '../application/project-gateway';
import { CoinsIcon } from './icons';
import { wizardTextAr } from './messages.ar';
import { SETUP_BUDGET_PATH, SETUP_DETAILS_PATH } from './routes';
import { useWizardDraft } from './use-wizard-draft';
import { WizardShell } from './WizardShell';
import styles from './wizard.module.css';

const t = wizardTextAr.phases;

export function PhasesStep({ template }: { template: TemplatePhase[] }) {
  const router = useRouter();
  const { draft, update } = useWizardDraft();
  const [error, setError] = useState<string | null>(null);
  if (!draft) return null;

  const current = draft.currentPhase ?? null;
  const label = (position: number) =>
    current === null ? '' : position < current ? t.done : position === current ? t.current : t.later;
  const unreviewed = template.some((p) => p.status !== 'approved');

  const next = () => {
    if (current === null || !template.some((p) => p.position === current)) {
      setError(t.chooseCurrent);
      return;
    }
    router.push(SETUP_BUDGET_PATH);
  };

  return (
    <WizardShell
      step={2}
      title={t.title}
      subtitle={t.subtitle}
      backHref={SETUP_DETAILS_PATH}
      actions={
        <button type="button" className={styles.primary} onClick={next}>
          {t.next}
        </button>
      }
    >
      <fieldset className={styles.list} aria-describedby={error ? 'phase-error' : undefined}>
        <legend className={styles.hint} style={{ position: 'absolute', inlineSize: 1, blockSize: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}>
          {t.subtitle}
        </legend>
        {template.map((p) => (
          <label key={p.position} className={styles.listRow}>
            <input
              type="radio"
              name="currentPhase"
              value={p.position}
              checked={current === p.position}
              onChange={() => {
                update({ currentPhase: p.position });
                setError(null);
              }}
            />
            <span className={styles.rowIcon}>
              <CoinsIcon />
            </span>
            <span className={styles.rowText}>
              <strong>{p.name}</strong>
              {p.description && <small>{p.description}</small>}
            </span>
            <span className={styles.rowValue}>{label(p.position)}</span>
          </label>
        ))}
      </fieldset>
      {error && (
        <p id="phase-error" role="alert" className={styles.fieldError}>
          {error}
        </p>
      )}
      {unreviewed && <p className={styles.info}>{t.unreviewedNote}</p>}
    </WizardShell>
  );
}
