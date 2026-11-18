'use client';

// «إضافة وثيقة» (FR-DOC-01, design S30.2): name, type, phase, version, file. The file type and size are checked in
// the browser (planPickedDocument) and again on the server against the stored file. PDF, JPEG and PNG are uploaded as
// they are; other images (an iPhone's HEIC, WebP) are converted to JPEG first, with the same code as site photos.
// Upload in three steps, as for photos: token from the server -> upload from the browser -> server checks and records.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { createBrowserSupabase } from '@/platform/supabase/browser';
import { PROJECT_FILES_BUCKET } from '@/platform/supabase/storage';
import { DOCUMENT_KINDS, planPickedDocument, validateDocumentDetails, type DocumentField, type DocumentType } from '../domain/document';
import { prepareDocumentUploadAction, saveDocumentAction } from './actions';
import { compressPhoto, sizeAr } from './compress-photo';
import { documentErrorsAr, documentKindAr, documentsTextAr, photoClientErrorsAr } from './messages.ar';
import { BackIcon } from './PhotoForm';
import { documentsOfPhasePath, DOCUMENTS_PATH } from './routes';
import styles from './documents.module.css';

const t = documentsTextAr.form;

interface Props {
  phases: { id: string; name: string }[];
  /** Preselected phase (when opened from a phase's documents, S10.4). */
  phaseId: string | null;
}

type Step = 'idle' | 'converting' | 'uploading' | 'saving';

export function DocumentForm({ phases, phaseId }: Props) {
  const router = useRouter();
  const [file, setFile] = useState<{ blob: Blob; type: DocumentType; name: string } | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<DocumentField, string>>>({});
  const busy = step !== 'idle';
  const listHref = phaseId ? documentsOfPhasePath(phaseId) : DOCUMENTS_PATH;

  async function onPick(picked: File | undefined) {
    setFormError(null);
    setFieldErrors({});
    setFile(null);
    if (!picked) return;
    const plan = planPickedDocument(picked);
    if (plan.kind === 'refuse') {
      setFieldErrors({ file: documentErrorsAr[plan.reason] });
      return;
    }
    if (plan.kind === 'as_is') {
      setFile({ blob: picked, type: plan.type, name: picked.name });
      return;
    }
    setStep('converting');
    const converted = await compressPhoto(picked);
    setStep('idle');
    if (!converted.ok) {
      setFieldErrors({ file: photoClientErrorsAr[converted.reason] });
      return;
    }
    setFile({ blob: converted.photo.blob, type: 'image/jpeg', name: picked.name.replace(/\.[^.]+$/, '') + '.jpg' });
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    if (!file) {
      setFieldErrors({ file: t.needFile });
      return;
    }
    const form = new FormData(e.currentTarget);
    const text = (k: string) => String(form.get(k) ?? '');

    // Check the form first, so nothing is uploaded when a field is missing (the server checks again).
    const checked = validateDocumentDetails({ title: text('title'), kind: text('kind'), phaseId: text('phaseId'), version: text('version') });
    if (!checked.ok) {
      const errors: Partial<Record<DocumentField, string>> = {};
      for (const err of checked.errors) errors[err.field] ??= documentErrorsAr[err.code];
      setFieldErrors(errors);
      return;
    }

    setStep('uploading');
    const ticket = await prepareDocumentUploadAction(file.type);
    if (!ticket.ok) {
      setStep('idle');
      setFormError(ticket.message);
      return;
    }
    const upload = await createBrowserSupabase()
      .storage.from(PROJECT_FILES_BUCKET)
      .uploadToSignedUrl(ticket.path, ticket.token, file.blob, { contentType: file.type });
    if (upload.error) {
      setStep('idle');
      setFormError(photoClientErrorsAr.uploadFailed);
      return;
    }

    setStep('saving');
    const saved = await saveDocumentAction({
      storagePath: ticket.path,
      contentType: file.type,
      title: text('title'),
      kind: text('kind'),
      phaseId: text('phaseId'),
      version: text('version'),
    });
    if (!saved.ok) {
      setStep('idle');
      setFormError(saved.formError ?? null);
      setFieldErrors(saved.fieldErrors ?? {});
      return;
    }
    router.push(listHref);
    router.refresh();
  }

  const invalid = (f: DocumentField) => ({
    'aria-invalid': fieldErrors[f] ? (true as const) : undefined,
    'aria-describedby': fieldErrors[f] ? `${f}-error` : undefined,
  });
  const errorOf = (f: DocumentField) =>
    fieldErrors[f] && (
      <p id={`${f}-error`} className={styles.fieldError}>
        {fieldErrors[f]}
      </p>
    );
  const star = <span aria-hidden="true">*</span>;
  const stepText = { converting: t.converting, uploading: t.uploading, saving: t.saving, idle: '' }[step];

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={listHref} className={styles.iconButton} aria-label={documentsTextAr.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.subtitle}>{t.subtitle}</p>
        </div>
      </header>

      <div className={styles.scroll}>
        <form id="document-form" onSubmit={onSubmit} noValidate>
          {formError && (
            <p role="alert" className={styles.errorSummary}>
              {formError}
            </p>
          )}

          <div className={styles.field}>
            <label htmlFor="title" className={styles.label}>
              {t.name} {star}
            </label>
            <input id="title" name="title" type="text" autoComplete="off" placeholder={t.namePlaceholder} required className={styles.input} {...invalid('title')} />
            {errorOf('title')}
          </div>

          <div className={styles.field}>
            <label htmlFor="kind" className={styles.label}>
              {t.kind} {star}
            </label>
            <select id="kind" name="kind" required defaultValue="" className={styles.input} {...invalid('kind')}>
              <option value="" disabled>
                {t.kindPlaceholder}
              </option>
              {DOCUMENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {documentKindAr[k]}
                </option>
              ))}
            </select>
            {errorOf('kind')}
          </div>

          <div className={styles.field}>
            <label htmlFor="phaseId" className={styles.label}>
              {t.phase}
            </label>
            <select id="phaseId" name="phaseId" defaultValue={phaseId ?? ''} className={styles.input} {...invalid('phaseId')}>
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
            <label htmlFor="version" className={styles.label}>
              {t.version}
            </label>
            <input id="version" name="version" type="text" dir="ltr" maxLength={20} autoComplete="off" placeholder={t.versionPlaceholder} className={styles.input} {...invalid('version')} />
            {errorOf('version')}
          </div>

          <div className={styles.field}>
            <span className={styles.label} id="file-label">
              {t.file} {star}
            </span>
            <label className={file ? `${styles.picker} ${styles.pickerCompact}` : styles.picker}>
              <input
                type="file"
                name="file"
                accept=".pdf,application/pdf,image/*,.heic,.heif"
                className={styles.visuallyHidden}
                aria-labelledby="file-label"
                aria-invalid={fieldErrors.file ? true : undefined}
                aria-describedby={fieldErrors.file ? 'file-error file-helper' : 'file-helper'}
                disabled={busy}
                onChange={(e) => void onPick(e.target.files?.[0])}
              />
              {file ? t.change : t.pick}
            </label>
            {file && (
              <p className={styles.hint}>
                <bdi>{file.name}</bdi> · <bdi>{sizeAr(file.blob.size)}</bdi>
              </p>
            )}
            <p id="file-helper" className={styles.hint}>
              {t.fileHelper}
            </p>
            {errorOf('file')}
          </div>

          {busy && (
            <p role="status" className={styles.info}>
              {stepText}
            </p>
          )}
        </form>
      </div>

      <div className={styles.actions}>
        <button type="submit" form="document-form" className={styles.primary} disabled={busy}>
          {busy && step !== 'converting' ? stepText : t.save}
        </button>
      </div>
    </main>
  );
}
