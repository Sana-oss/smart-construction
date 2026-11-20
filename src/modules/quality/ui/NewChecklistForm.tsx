'use client';

// A new pre-pour checklist for one phase (FR-QLT-02): a name (one phase has several pours) and the template to copy.
// The template's review status is shown before it is used. No design screen: built from the design's form fields.

import Link from 'next/link';
import { useActionState } from 'react';
import type { TemplateRecord } from '../application/checklists';
import type { NewChecklistState } from './checklist-actions';
import { BackIcon } from './icons';
import { checklistTextAr } from './messages.ar';
import styles from './quality.module.css';

const t = checklistTextAr.form;
const FORM_ID = 'checklist-form';

interface Props {
  action: (prev: NewChecklistState, form: FormData) => Promise<NewChecklistState>;
  phaseName: string;
  templates: TemplateRecord[];
  backHref: string;
}

export function NewChecklistForm({ action, phaseName, templates, backHref }: Props) {
  const [state, formAction, pending] = useActionState(action, {} as NewChecklistState);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? { templateId: templates[0]?.id ?? '' };

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={backHref} className={styles.iconButton} aria-label={checklistTextAr.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.subtitle}>{t.subtitle(phaseName)}</p>
        </div>
      </header>

      <div className={styles.scroll}>
        <form id={FORM_ID} action={formAction} noValidate key={JSON.stringify(state.values ?? {})}>
          {state.formError && (
            <p role="alert" className={styles.errorSummary}>
              {state.formError}
            </p>
          )}
          <p className={styles.hint}>{checklistTextAr.requiredHint}</p>
          <div className={styles.field}>
            <label htmlFor="title" className={styles.label}>
              {t.name} <span aria-hidden="true">*</span>
            </label>
            <input
              id="title"
              name="title"
              type="text"
              autoComplete="off"
              className={styles.input}
              defaultValue={values.title ?? ''}
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={errors.title ? 'title-error title-hint' : 'title-hint'}
            />
            <p id="title-hint" className={styles.hint}>
              {t.nameHint}
            </p>
            {errors.title && (
              <p id="title-error" className={styles.fieldError}>
                {errors.title}
              </p>
            )}
          </div>

          <fieldset className={styles.field} aria-describedby={errors.templateId ? 'template-error' : undefined}>
            <legend className={styles.label}>
              {t.template} <span aria-hidden="true">*</span>
            </legend>
            {templates.map((tpl) => (
              <label key={tpl.id} className={styles.choice}>
                <input type="radio" name="templateId" value={tpl.id} defaultChecked={values.templateId === tpl.id} />
                <span className={styles.rowText}>
                  <strong>{tpl.title}</strong>
                  <small>
                    {t.templateNote(tpl.itemCount)}
                    <span className={styles.tag}>{tpl.status === 'approved' ? checklistTextAr.approvedBy : checklistTextAr.unreviewed}</span>
                  </small>
                </span>
              </label>
            ))}
            {errors.templateId && (
              <p id="template-error" className={styles.fieldError}>
                {errors.templateId}
              </p>
            )}
          </fieldset>
          <p className={styles.hint}>{checklistTextAr.engineerNote}</p>
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
