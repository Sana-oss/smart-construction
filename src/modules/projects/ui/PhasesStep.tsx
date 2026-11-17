'use client';

// Step 2 of the wizard: choose the current phase (FR-PRJ-01 "current phase", FR-PRJ-03). Design: S02.2.
// The chosen phase shows "الحالية", later ones "لاحقًا". Earlier phases (solution B, decision of 16 Nov 2026):
// they start as finished, and the owner can untick any that is not finished yet, so the system never records a
// phase as finished only because a later one was chosen. One tap is still enough when the earlier phases ARE done.
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
const visuallyHidden = { position: 'absolute', inlineSize: 1, blockSize: 1, overflow: 'hidden', clipPath: 'inset(50%)' } as const;

export function PhasesStep({ template }: { template: TemplatePhase[] }) {
  const router = useRouter();
  const { draft, update } = useWizardDraft();
  const [error, setError] = useState<string | null>(null);
  if (!draft) return null;

  const current = draft.currentPhase ?? null;
  // Only answers about phases before the current one count (the domain ignores the rest too).
  const unfinished = new Set((draft.unfinishedPhases ?? []).filter((p) => current !== null && p < current));
  const earlier = current === null ? [] : template.filter((p) => p.position < current);
  const label = (position: number) =>
    current === null
      ? ''
      : position === current
        ? t.current
        : position > current
          ? t.later
          : unfinished.has(position)
            ? t.notFinished
            : t.done;
  const unreviewed = template.some((p) => p.status !== 'approved');

  const setFinished = (position: number, finished: boolean) => {
    const next = new Set(unfinished);
    if (finished) next.delete(position);
    else next.add(position);
    update({ unfinishedPhases: [...next].sort((a, b) => a - b) });
  };

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
        <legend className={styles.hint} style={visuallyHidden}>
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

      {earlier.length > 0 && (
        <fieldset className={styles.choiceGroup}>
          <legend className={styles.label}>{t.earlierTitle}</legend>
          <p className={styles.helper}>{t.earlierHelper}</p>
          {earlier.map((p) => (
            <label key={p.position} className={styles.check}>
              <input type="checkbox" checked={!unfinished.has(p.position)} onChange={(e) => setFinished(p.position, e.target.checked)} />
              <span>{t.finishedCheck(p.name)}</span>
            </label>
          ))}
        </fieldset>
      )}

      {unreviewed && <p className={styles.info}>{t.unreviewedNote}</p>}
    </WizardShell>
  );
}
