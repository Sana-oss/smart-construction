'use client';

// Record a defect or a note (design S28.2 «تسجيل عيب»; FR-QLT-06): title, place, description, who fixes it, priority,
// phase, due date, and one optional photo. Opened from the list, a phase, or a checklist item with a problem (S26.2
// «تسجيل عيب مرتبط»), which fills the form and keeps the link. The check and the upload run on submit, before the form
// action, so a refusal here keeps what the owner typed (React resets a form after its action).

import Link from 'next/link';
import { startTransition, useActionState, type FormEvent } from 'react';
import { ISSUE_SEVERITIES, validateIssue, type IssueField } from '../domain/issue';
import { addIssueAction, type IssueFormState } from './issue-actions';
import { BackIcon } from './icons';
import { issueTextAr } from './messages.ar';
import { useIssuePhoto } from './use-issue-photo';
import styles from './quality.module.css';

const t = issueTextAr.form;
const FORM_ID = 'issue-form';

interface Props {
  phases: { id: string; name: string }[];
  /** Pre-filled values (from a phase or a checklist item). */
  start: { phaseId?: string; title?: string; description?: string; responsible?: string; checklistId?: string };
  /** The checklist item the defect comes from, shown above the form. */
  fromItem?: string | null;
  backHref: string;
}

export function IssueForm({ phases, start, fromItem = null, backHref }: Props) {
  const [state, formAction, pending] = useActionState(addIssueAction, {} as IssueFormState);
  const photo = useIssuePhoto();
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? { ...start, severity: 'major' };
  const optional = <small className={styles.optional}>({issueTextAr.optional})</small>;
  const star = <span aria-hidden="true">*</span>;

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    photo.setError(null);
    const read = (k: string) => String(form.get(k) ?? '');
    // Checked here first (the server checks again): nothing is uploaded for a defect the server will refuse.
    const checked = validateIssue(
      { title: read('title'), location: read('location'), description: read('description'), responsible: read('responsible'), severity: read('severity'), dueOn: read('dueOn') },
      { phase: () => true, checklist: () => true },
    );
    if (photo.photo && checked.ok) {
      const path = await photo.upload();
      if (!path) return;
      form.set('photoPath', path);
    }
    startTransition(() => formAction(form));
  }
  const busy = pending || photo.step !== 'idle';

  const describe = (name: IssueField, hint: boolean) =>
    [errors[name] && `${name}-error`, hint && `${name}-hint`].filter(Boolean).join(' ') || undefined;
  const after = (name: IssueField, hint?: string) => (
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
  const text = (name: 'title' | 'location' | 'responsible', label: string, required: boolean, hint?: string) => (
    <div className={styles.field}>
      <label htmlFor={name} className={styles.label}>
        {label} {required ? star : optional}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        autoComplete="off"
        className={styles.input}
        defaultValue={values[name] ?? ''}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={describe(name, Boolean(hint))}
      />
      {after(name, hint)}
    </div>
  );

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={backHref} className={styles.iconButton} aria-label={issueTextAr.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.subtitle}>{fromItem ? t.fromCheck(fromItem) : t.subtitle}</p>
        </div>
      </header>

      <div className={styles.scroll}>
        <form id={FORM_ID} onSubmit={(e) => void send(e)} noValidate key={JSON.stringify(state.values ?? {})}>
          {state.formError && (
            <p role="alert" className={styles.errorSummary}>
              {state.formError}
            </p>
          )}
          <input type="hidden" name="checklistId" value={values.checklistId ?? ''} />
          <p className={styles.hint}>{issueTextAr.requiredHint}</p>
          {text('title', t.titleLabel, true)}
          {text('location', t.location, false, t.locationHint)}
          <div className={styles.field}>
            <label htmlFor="description" className={styles.label}>
              {t.description} {optional}
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              className={styles.input}
              defaultValue={values.description ?? ''}
              aria-invalid={errors.description ? true : undefined}
              aria-describedby={describe('description', false)}
            />
            {after('description')}
          </div>
          {text('responsible', t.responsible, false, t.responsibleHint)}
          <div className={styles.field}>
            <label htmlFor="severity" className={styles.label}>
              {t.severity} {star}
            </label>
            <select id="severity" name="severity" className={styles.input} defaultValue={values.severity ?? 'major'} aria-describedby={describe('severity', true)}>
              {ISSUE_SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {issueTextAr.severity[s]}
                </option>
              ))}
            </select>
            {after('severity', t.severityHint)}
          </div>
          <div className={styles.field}>
            <label htmlFor="phaseId" className={styles.label}>
              {t.phase} {optional}
            </label>
            <select id="phaseId" name="phaseId" className={styles.input} defaultValue={values.phaseId ?? ''} aria-describedby={describe('phaseId', false)}>
              <option value="">{t.noPhase}</option>
              {phases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {after('phaseId')}
          </div>
          <div className={styles.field}>
            <label htmlFor="dueOn" className={styles.label}>
              {t.dueOn} {optional}
            </label>
            <input id="dueOn" name="dueOn" type="date" className={styles.input} defaultValue={values.dueOn ?? ''} aria-describedby={describe('dueOn', false)} />
            {after('dueOn')}
          </div>

          <div className={styles.field}>
            <span className={styles.label} id="photo-label">
              {t.photo} {optional}
            </span>
            {photo.photo && <img src={photo.photo.url} alt="" className={styles.receiptPreview} />}
            <label className={photo.photo ? `${styles.picker} ${styles.pickerCompact}` : styles.picker}>
              <input
                type="file"
                accept="image/*,.heic,.heif"
                className={styles.visuallyHidden}
                aria-labelledby="photo-label"
                aria-invalid={photo.error ? true : undefined}
                aria-describedby={photo.error ? 'photo-error' : undefined}
                disabled={busy}
                onChange={(e) => void photo.pick(e.target.files?.[0])}
              />
              {photo.photo ? issueTextAr.detail.photoReplace : issueTextAr.detail.photoAdd}
            </label>
            {photo.stepText && (
              <p role="status" className={styles.hint}>
                {photo.stepText}
              </p>
            )}
            {photo.error && (
              <p id="photo-error" role="alert" className={styles.fieldError}>
                {photo.error}
              </p>
            )}
          </div>
          <p className={styles.hint}>{issueTextAr.list.priorityNote}</p>
        </form>
      </div>

      <div className={styles.actions}>
        <button type="submit" form={FORM_ID} className={styles.primary} disabled={busy}>
          {busy ? t.submitting : t.submit}
        </button>
      </div>
    </main>
  );
}
