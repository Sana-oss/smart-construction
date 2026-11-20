'use client';

// One phase's status and dates (FR-PRJ-03). Opened from the phase page («الحالة والتواريخ»). The design has no screen for
// this yet (its S10.1 phase overview needs checklists and tasks that are not built), so the form uses the same
// pieces as the other forms: .field, .input, .actions. Saved through updatePhaseScheduleAction (Server Action).

import Link from 'next/link';
import { useActionState, type InputHTMLAttributes } from 'react';
import type { PhaseStatus } from '../domain/phase-plan';
import { PHASE_STATUSES, type PhaseSchedule, type PhaseScheduleField } from '../domain/phase-schedule';
import { BackIcon } from './icons';
import { phasesTextAr as t, phaseStatusAr } from './messages.ar';
import { updatePhaseScheduleAction, type PhaseFormState } from './phase-actions';
import styles from './wizard.module.css';

interface Props {
  phaseId: string;
  phaseName: string;
  schedule: PhaseSchedule;
  /** The date in Libya, "YYYY-MM-DD": the latest allowed actual date. */
  today: string;
  backHref: string;
  /**
   * The app's action, when the save needs more than this module knows (the readiness gate, 3.15). Defaults to this
   * module's own action.
   */
  action?: (prev: PhaseFormState, form: FormData) => Promise<PhaseFormState>;
  /** Where the owner can complete the readiness list (shown with the gate's warning). */
  readinessHref?: string;
  /** Where the owner can see the phase's defects (shown with the close warning, FR-QLT-07). */
  issuesHref?: string;
}

const initialState: PhaseFormState = {};
const FORM_ID = 'phase-schedule-form';

export function PhaseScheduleForm({ phaseId, phaseName, schedule, today, backHref, action, readinessHref, issuesHref }: Props) {
  const [state, formAction, pending] = useActionState(action ?? updatePhaseScheduleAction.bind(null, phaseId), initialState);
  const errors = state.fieldErrors ?? {};
  const value = (f: PhaseScheduleField) => state.values?.[f] ?? (schedule[f] as string | null) ?? '';

  const field = (f: Exclude<PhaseScheduleField, 'status'>, label: string, extra?: InputHTMLAttributes<HTMLInputElement>) => (
    <div className={styles.field}>
      <label htmlFor={f} className={styles.label}>
        {label}
      </label>
      <input
        id={f}
        name={f}
        type="date"
        className={styles.input}
        defaultValue={value(f)}
        aria-invalid={errors[f] ? true : undefined}
        aria-describedby={errors[f] ? `${f}-error` : undefined}
        {...extra}
      />
      {errors[f] && (
        <p id={`${f}-error`} className={styles.fieldError}>
          {errors[f]}
        </p>
      )}
    </div>
  );

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={backHref} className={styles.iconButton} aria-label={t.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{phaseName}</h1>
          <p className={styles.subtitle}>{t.form.subtitle}</p>
        </div>
      </header>

      <div className={styles.scroll}>
        {/* key: the form is rebuilt after a refused save, so the inputs show the values sent back. */}
        <form id={FORM_ID} action={formAction} noValidate key={JSON.stringify(state.values ?? {})}>
          {state.formError && (
            <p role="alert" className={styles.errorSummary}>
              {state.formError}
            </p>
          )}

          <div className={styles.field}>
            <label htmlFor="status" className={styles.label}>
              {t.form.status}
            </label>
            <select
              id="status"
              name="status"
              className={styles.input}
              defaultValue={value('status')}
              aria-invalid={errors.status ? true : undefined}
              aria-describedby={errors.status ? 'status-error' : 'status-helper'}
            >
              {PHASE_STATUSES.map((s: PhaseStatus) => (
                <option key={s} value={s}>
                  {phaseStatusAr[s]}
                </option>
              ))}
            </select>
            <p id="status-helper" className={styles.helper}>
              {t.form.closingNote}
            </p>
            {errors.status && (
              <p id="status-error" className={styles.fieldError}>
                {errors.status}
              </p>
            )}
          </div>

          <p className={styles.groupTitle}>{t.form.plannedTitle}</p>
          <div className={styles.dateRow}>
            {field('plannedStart', t.form.plannedStart)}
            {field('plannedEnd', t.form.plannedEnd)}
          </div>

          <p className={styles.groupTitle}>{t.form.actualTitle}</p>
          <div className={styles.dateRow}>
            {field('actualStart', t.form.actualStart, { max: today })}
            {field('actualEnd', t.form.actualEnd, { max: today })}
          </div>
          <p className={styles.helper}>{t.form.actualHelper}</p>

          {/* FR-PRJ-05 / D2: starting with readiness gaps is allowed, after an explicit, logged confirmation. */}
          {state.startGaps && state.startGaps.length > 0 && (
            <div className={styles.warning} role="alert">
              <strong>{t.form.gateTitle}</strong>
              <p>{t.form.gateNote}</p>
              <ul>
                {state.startGaps.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
              {readinessHref && <Link href={readinessHref}>{t.form.gateLink}</Link>}
              <label className={styles.check}>
                <input type="checkbox" name="startConfirmed" value="yes" /> {t.form.gateConfirm}
              </label>
            </div>
          )}
          {/* FR-QLT-07 / D2: finishing with open defects is allowed, after an explicit, logged confirmation. */}
          {state.closeOpenIssues && state.closeOpenIssues.length > 0 && (
            <div className={styles.warning} role="alert">
              <strong>{t.form.closeTitle}</strong>
              <p>{t.form.closeNote}</p>
              <ul>
                {state.closeOpenIssues.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
              {issuesHref && <Link href={issuesHref}>{t.form.closeLink}</Link>}
              <label className={styles.check}>
                <input type="checkbox" name="closeConfirmed" value="yes" /> {t.form.closeConfirm}
              </label>
            </div>
          )}
        </form>
      </div>

      <div className={styles.actions}>
        <button type="submit" form={FORM_ID} className={styles.primary} disabled={pending}>
          {pending ? t.form.saving : t.form.save}
        </button>
      </div>
    </main>
  );
}
