'use client';

// Recording the check of one item (design S26.2 «تفاصيل بند الفحص»; FR-QLT-01): the result, a note, who fixes it, when it
// is checked again, and one photo (slice 2). Who checked and when are set by the database (0025, 0026). The photo is
// compressed when picked and uploaded only when the check is sent, with a one-time token (prepareCheckPhotoUploadAction),
// like the receipt photo. An item that requires a photo is not «سليم» without one (checked here first, then by the
// server and the database). The design's «تسجيل عيب مرتبط» waits for the defects list (3.17).

import Link from 'next/link';
import { startTransition, useActionState, useEffect, useState, type FormEvent } from 'react';
import { checkPickedImage } from '@/shared-kernel';
import { compressImage } from '@/platform/images/compress-image';
import { createBrowserSupabase } from '@/platform/supabase/browser';
import { PROJECT_FILES_BUCKET } from '@/platform/supabase/storage';
import type { ChecklistItemRecord } from '../application/checklists';
import { CHECK_RESULTS, photoRequirement, validateCheck, type CheckField } from '../domain/checklist';
import { prepareCheckPhotoUploadAction, type CheckState } from './checklist-actions';
import { BackIcon } from './icons';
import { checklistErrorsAr, checklistTextAr } from './messages.ar';
import styles from './quality.module.css';

const t = checklistTextAr.item;
const FORM_ID = 'check-form';

interface Props {
  action: (prev: CheckState, form: FormData) => Promise<CheckState>;
  item: ChecklistItemRecord;
  /** A short-lived link to the stored photo, or null. */
  photoUrl: string | null;
  checklistTitle: string;
  /** Readiness items are «متوفر / ناقص», not «سليم / توجد ملاحظة». */
  kind?: 'hold_point' | 'readiness';
  backHref: string;
}

export function CheckItemForm({ action, item, photoUrl, checklistTitle, kind = 'hold_point', backHref }: Props) {
  const resultLabels = kind === 'readiness' ? checklistTextAr.readinessResult : checklistTextAr.result;
  const [state, formAction, pending] = useActionState(action, {} as CheckState);
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [photoStep, setPhotoStep] = useState<'idle' | 'preparing' | 'converting' | 'uploading'>('idle');
  const [photoError, setPhotoError] = useState<string | null>(null);
  useEffect(() => () => void (photo && URL.revokeObjectURL(photo.url)), [photo]);

  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {
    result: item.result ?? '',
    note: item.note ?? '',
    responsible: item.responsible ?? '',
    recheckOn: item.recheckOn ?? '',
  };
  const shownPhotoError = photoError ?? errors.photo ?? null;
  const optional = <small className={styles.optional}>({checklistTextAr.optional})</small>;

  async function pickPhoto(file: File | undefined) {
    setPhotoError(null);
    if (!file) return;
    const problem = checkPickedImage(file);
    if (problem) {
      setPhotoError(problem === 'too_large' ? t.photoTooLarge : t.photoNotImage);
      return;
    }
    setPhotoStep('preparing');
    const result = await compressImage(file, () => setPhotoStep('converting'));
    setPhotoStep('idle');
    if (!result.ok) {
      setPhotoError(result.reason === 'heicFailed' ? t.photoHeicFailed : t.photoUnreadable);
      return;
    }
    setPhoto({ blob: result.photo.blob, url: URL.createObjectURL(result.photo.blob) });
  }

  /**
   * With a new photo: check the form here first (nothing is uploaded for a check the server will refuse), then upload.
   * Runs on submit, before the form action: React resets a form once its action returns, so a refusal here must not
   * go through the action, or the owner's answers would be wiped.
   */
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPhotoError(null);
    const read = (k: string) => String(form.get(k) ?? '');
    const checked = validateCheck({ result: read('result'), note: read('note'), responsible: read('responsible'), recheckOn: read('recheckOn') });
    if (checked.ok && photoRequirement(checked.value.result, item.requiresPhoto, photo !== null || item.photoPath !== null)) {
      setPhotoError(checklistErrorsAr.photo_required);
      return;
    }
    if (photo && checked.ok) {
      setPhotoStep('uploading');
      const ticket = await prepareCheckPhotoUploadAction();
      if (!ticket.ok) {
        setPhotoStep('idle');
        setPhotoError(ticket.message);
        return;
      }
      const upload = await createBrowserSupabase()
        .storage.from(PROJECT_FILES_BUCKET)
        .uploadToSignedUrl(ticket.path, ticket.token, photo.blob, { contentType: 'image/jpeg' });
      setPhotoStep('idle');
      if (upload.error) {
        setPhotoError(t.photoUploadFailed);
        return;
      }
      form.set('photoPath', ticket.path);
    }
    // After an await this is no longer inside the form's transition: start one, so `pending` stays true while saving.
    startTransition(() => formAction(form));
  }
  const busy = pending || photoStep !== 'idle';

  const errorOf = (name: CheckField) =>
    errors[name] && (
      <p id={`${name}-error`} className={styles.fieldError}>
        {errors[name]}
      </p>
    );
  const text = (name: 'note' | 'responsible', label: string, hint?: string) => (
    <div className={styles.field}>
      <label htmlFor={name} className={styles.label}>
        {label} {optional}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        autoComplete="off"
        className={styles.input}
        defaultValue={values[name] ?? ''}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={[errors[name] && `${name}-error`, hint && `${name}-hint`].filter(Boolean).join(' ') || undefined}
      />
      {hint && (
        <p id={`${name}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
      {errorOf(name)}
    </div>
  );

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={backHref} className={styles.iconButton} aria-label={checklistTextAr.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{item.text}</h1>
          <p className={styles.subtitle}>
            {t.title} · {checklistTitle}
          </p>
        </div>
      </header>

      <div className={styles.scroll}>
        <form id={FORM_ID} onSubmit={(e) => void send(e)} noValidate key={JSON.stringify(state.values ?? {})}>
          {state.formError && (
            <p role="alert" className={styles.errorSummary}>
              {state.formError}
            </p>
          )}
          <fieldset className={styles.field} aria-describedby={errors.result ? 'result-error' : undefined}>
            <legend className={styles.label}>
              {t.result} <span aria-hidden="true">*</span>
            </legend>
            {CHECK_RESULTS.map((r) => (
              <label key={r} className={styles.choice}>
                <input type="radio" name="result" value={r} defaultChecked={values.result === r} />
                <span>{resultLabels[r]}</span>
              </label>
            ))}
            {errorOf('result')}
          </fieldset>

          <div className={styles.field}>
            <span className={styles.label} id="photo-label">
              {t.photo} {item.requiresPhoto ? <span className={styles.tag}>{t.photoRequired}</span> : optional}
            </span>
            {photo ? (
              <img src={photo.url} alt="" className={styles.receiptPreview} />
            ) : (
              photoUrl && <img src={photoUrl} alt={t.photoCurrent} className={styles.receiptPreview} />
            )}
            <label className={photo || photoUrl ? `${styles.picker} ${styles.pickerCompact}` : styles.picker}>
              <input
                type="file"
                accept="image/*,.heic,.heif"
                className={styles.visuallyHidden}
                aria-labelledby="photo-label"
                aria-invalid={shownPhotoError ? true : undefined}
                aria-describedby={shownPhotoError ? 'photo-error' : undefined}
                disabled={busy}
                onChange={(e) => void pickPhoto(e.target.files?.[0])}
              />
              {photo || photoUrl ? t.photoChange : t.photoPick}
            </label>
            {photo && (
              <button type="button" className={styles.linkButton} onClick={() => setPhoto(null)} disabled={busy}>
                {t.photoRemove}
              </button>
            )}
            {photoStep !== 'idle' && (
              <p role="status" className={styles.hint}>
                {photoStep === 'converting' ? t.photoConverting : photoStep === 'uploading' ? t.photoUploading : t.photoPreparing}
              </p>
            )}
            {shownPhotoError && (
              <p id="photo-error" role="alert" className={styles.fieldError}>
                {shownPhotoError}
              </p>
            )}
          </div>

          {text('note', t.note)}
          {text('responsible', t.responsible, t.responsibleHint)}
          <div className={styles.field}>
            <label htmlFor="recheckOn" className={styles.label}>
              {t.recheckOn} {optional}
            </label>
            <input
              id="recheckOn"
              name="recheckOn"
              type="date"
              className={styles.input}
              defaultValue={values.recheckOn ?? ''}
              aria-invalid={errors.recheckOn ? true : undefined}
              aria-describedby={errors.recheckOn ? 'recheckOn-error' : undefined}
            />
            {errorOf('recheckOn')}
          </div>
          <p className={styles.hint}>{checklistTextAr.engineerNote}</p>
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
