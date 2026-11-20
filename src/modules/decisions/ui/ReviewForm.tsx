'use client';

// Review the scenario (design S18.2 «مراجعة السيناريو»). The design gives steps to «المهندس المسؤول» and «مسؤول المشروع»,
// whose accounts are excluded, so the steps are a checklist the OWNER ticks, each saying who does it in real life
// (owner's decision of 19 Nov 2026). The design's «عرض خطة التوقف للمراجعة» needs safe stopping points (3.14, not built):
// the actions are «حفظ المراجعة» and «العودة للمقارنة» (change register).

import Link from 'next/link';
import { useActionState } from 'react';
import type { Review } from '../domain/review';
import { REVIEW_STEPS } from '../domain/review';
import { SCENARIOS } from '../domain/scenarios';
import { saveReviewAction, type ReviewFormState } from './actions';
import { BackIcon } from './icons';
import { decisionTextAr, scenarioName } from './messages.ar';
import styles from './decisions.module.css';

const t = decisionTextAr.review;
const FORM_ID = 'review-form';

interface Props {
  review: Review | null;
  phaseName: string | null;
  backHref: string;
}

export function ReviewForm({ review, phaseName, backHref }: Props) {
  const [state, formAction, pending] = useActionState(saveReviewAction, {} as ReviewFormState);
  const errors = state.fieldErrors ?? {};

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={backHref} className={styles.iconButton} aria-label={decisionTextAr.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.subtitle}>{t.subtitle}</p>
        </div>
      </header>

      <div className={styles.scroll}>
        <form id={FORM_ID} action={formAction} noValidate>
          {state.formError && (
            <p role="alert" className={styles.errorSummary}>
              {state.formError}
            </p>
          )}

          <div className={styles.field}>
            <label htmlFor="note" className={styles.label}>
              {t.note}
            </label>
            <textarea
              id="note"
              name="note"
              className={`${styles.input} ${styles.textarea}`}
              defaultValue={review?.note ?? ''}
              aria-invalid={errors.note ? true : undefined}
              aria-describedby={errors.note ? 'note-error' : undefined}
            />
            {errors.note && (
              <p id="note-error" className={styles.fieldError}>
                {errors.note}
              </p>
            )}
          </div>

          <fieldset className={`${styles.field} ${styles.fieldset}`}>
            <legend className={styles.label}>{t.stepsTitle}</legend>
            <p className={styles.hint}>{t.ownerTicks}</p>
            <div className={styles.list}>
              {REVIEW_STEPS.map((s) => (
                <label key={s.key} className={styles.check}>
                  <input type="checkbox" name="steps" value={s.key} defaultChecked={review?.steps[s.key] ?? false} />
                  <span className={styles.rowText}>
                    <strong>{t.steps[s.key]}</strong>
                    <small>{t.who[s.who]}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className={styles.field}>
            <label htmlFor="choice" className={styles.label}>
              {t.choice}
            </label>
            <select id="choice" name="choice" className={styles.input} defaultValue={review?.choice ?? ''}>
              <option value="">{t.noChoice}</option>
              {SCENARIOS.map((s) => (
                <option key={s} value={s}>
                  {scenarioName(s, phaseName)}
                </option>
              ))}
            </select>
          </div>
        </form>
      </div>

      <div className={styles.actions}>
        <button type="submit" form={FORM_ID} className={styles.primary} disabled={pending}>
          {pending ? t.submitting : t.submit}
        </button>
        <Link href={backHref} className={styles.secondary}>
          {t.backToComparison}
        </Link>
      </div>
    </main>
  );
}
