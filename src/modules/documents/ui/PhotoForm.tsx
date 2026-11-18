'use client';

// «صورة وملاحظة» (FR-DOC-02, design S31.2). The photo is compressed IN THE BROWSER (compress-photo.ts), then:
//   1. preparePhotoUploadAction -> a path in the owner's project folder + a one-time upload token,
//   2. the browser uploads the JPEG straight to private storage with that token,
//   3. savePhotoAction checks the stored file and records the photo.
// No camera-only "capture" attribute: the phone offers both the camera and the gallery.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { createBrowserSupabase } from '@/platform/supabase/browser';
import { PROJECT_FILES_BUCKET } from '@/platform/supabase/storage';
import { checkPickedFile, validatePhotoDetails, type PhotoField } from '../domain/photo';
import { preparePhotoUploadAction, savePhotoAction } from './actions';
import { compressPhoto, sizeAr, type CompressedPhoto } from './compress-photo';
import { photoClientErrorsAr, photoErrorsAr, photosTextAr } from './messages.ar';
import { PHOTOS_PATH } from './routes';
import styles from './documents.module.css';

const t = photosTextAr.form;

export interface PhotoPhaseOption {
  id: string;
  name: string;
  current: boolean;
}

type Step = 'idle' | 'preparing' | 'converting' | 'uploading' | 'saving';

export function PhotoForm({ phases, today }: { phases: PhotoPhaseOption[]; today: string }) {
  const router = useRouter();
  const [photo, setPhoto] = useState<(CompressedPhoto & { originalBytes: number }) | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<PhotoField, string>>>({});
  const busy = step !== 'idle';

  // Free the preview's memory when it changes or the page closes.
  useEffect(() => () => void (previewUrl && URL.revokeObjectURL(previewUrl)), [previewUrl]);

  async function onPick(file: File | undefined) {
    setFormError(null);
    setFieldErrors({});
    if (!file) return;
    const problem = checkPickedFile(file);
    if (problem) {
      setFieldErrors({ file: photoErrorsAr[problem.code] });
      return;
    }
    setStep('preparing');
    const result = await compressPhoto(file, () => setStep('converting'));
    setStep('idle');
    if (!result.ok) {
      setFieldErrors({ file: photoClientErrorsAr[result.reason] });
      return;
    }
    setPhoto({ ...result.photo, originalBytes: file.size });
    setPreviewUrl(URL.createObjectURL(result.photo.blob));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    if (!photo) {
      setFieldErrors({ file: t.needPhoto });
      return;
    }
    const form = new FormData(e.currentTarget);
    const text = (k: string) => String(form.get(k) ?? '');

    // Check the details first, so nothing is uploaded when one is wrong (the server checks again).
    const checked = validatePhotoDetails({ phaseId: text('phaseId'), takenOn: text('takenOn'), note: text('note') }, today);
    if (!checked.ok) {
      const errors: Partial<Record<PhotoField, string>> = {};
      for (const err of checked.errors) errors[err.field] ??= photoErrorsAr[err.code];
      setFieldErrors(errors);
      return;
    }

    setStep('uploading');
    const ticket = await preparePhotoUploadAction();
    if (!ticket.ok) {
      setStep('idle');
      setFormError(ticket.message);
      return;
    }
    const upload = await createBrowserSupabase()
      .storage.from(PROJECT_FILES_BUCKET)
      .uploadToSignedUrl(ticket.path, ticket.token, photo.blob, { contentType: 'image/jpeg' });
    if (upload.error) {
      setStep('idle');
      setFormError(photoClientErrorsAr.uploadFailed);
      return;
    }

    setStep('saving');
    const saved = await savePhotoAction({
      storagePath: ticket.path,
      phaseId: text('phaseId'),
      takenOn: text('takenOn'),
      note: text('note'),
    });
    if (!saved.ok) {
      setStep('idle');
      setFormError(saved.formError ?? null);
      setFieldErrors(saved.fieldErrors ?? {});
      return;
    }
    router.push(PHOTOS_PATH);
    router.refresh();
  }

  const errorOf = (f: PhotoField) =>
    fieldErrors[f] && (
      <p id={`${f}-error`} className={styles.fieldError}>
        {fieldErrors[f]}
      </p>
    );
  const invalid = (f: PhotoField) => ({
    'aria-invalid': fieldErrors[f] ? (true as const) : undefined,
    'aria-describedby': fieldErrors[f] ? `${f}-error` : undefined,
  });
  const stepText = { preparing: t.preparing, converting: t.converting, uploading: t.uploading, saving: t.saving, idle: '' }[step];

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={PHOTOS_PATH} className={styles.iconButton} aria-label={photosTextAr.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.subtitle}>{t.subtitle}</p>
        </div>
      </header>

      <div className={styles.scroll}>
        <form id="photo-form" onSubmit={onSubmit} noValidate>
          {formError && (
            <p role="alert" className={styles.errorSummary}>
              {formError}
            </p>
          )}

          <div className={styles.field}>
            <span className={styles.label} id="file-label">
              {t.photo} <span aria-hidden="true">*</span>
            </span>
            {previewUrl && <img src={previewUrl} alt="" className={styles.preview} />}
            <label className={previewUrl ? `${styles.picker} ${styles.pickerCompact}` : styles.picker}>
              <input
                type="file"
                name="file"
                accept="image/*,.heic,.heif"
                className={styles.visuallyHidden}
                aria-labelledby="file-label"
                disabled={busy}
                onChange={(e) => void onPick(e.target.files?.[0])}
                {...invalid('file')}
              />
              {previewUrl ? t.change : t.pick}
            </label>
            {photo && <p className={styles.hint}>{t.sizes(sizeAr(photo.originalBytes), sizeAr(photo.blob.size))}</p>}
            {errorOf('file')}
          </div>

          <div className={styles.field}>
            <label htmlFor="phaseId" className={styles.label}>
              {t.phase}
            </label>
            <select id="phaseId" name="phaseId" className={styles.input} defaultValue={phases.find((p) => p.current)?.id ?? ''} {...invalid('phaseId')}>
              <option value="">{t.noPhase}</option>
              {phases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {errorOf('phaseId')}
          </div>

          <div className={styles.field}>
            <label htmlFor="takenOn" className={styles.label}>
              {t.date}
            </label>
            <input id="takenOn" name="takenOn" type="date" max={today} defaultValue={today} className={styles.input} {...invalid('takenOn')} />
            {errorOf('takenOn')}
          </div>

          <div className={styles.field}>
            <label htmlFor="note" className={styles.label}>
              {t.note}
            </label>
            <textarea id="note" name="note" maxLength={500} placeholder={t.notePlaceholder} className={`${styles.input} ${styles.textarea}`} {...invalid('note')} />
            {errorOf('note')}
          </div>

          <p className={styles.hint}>{t.privacy}</p>
          {busy && (
            <p role="status" className={styles.info}>
              {stepText}
            </p>
          )}
        </form>
      </div>

      <div className={styles.actions}>
        <button type="submit" form="photo-form" className={styles.primary} disabled={busy}>
          {busy && step !== 'preparing' && step !== 'converting' ? stepText : t.save}
        </button>
      </div>
    </main>
  );
}

/** "Back" in an RTL interface (Lucide chevron-left turned around, as in the design). */
export function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable={false} style={{ transform: 'rotate(180deg)' }}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}
