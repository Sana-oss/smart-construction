'use client';

// The defect's one photo, on S28.3: shown through a short-lived link, and added or replaced (the old file is removed).

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { replaceIssuePhotoAction } from './issue-actions';
import { issueTextAr } from './messages.ar';
import { useIssuePhoto } from './use-issue-photo';
import styles from './quality.module.css';

const t = issueTextAr.detail;

export function IssuePhotoForm({ issueId, photoUrl }: { issueId: string; photoUrl: string | null }) {
  const router = useRouter();
  const photo = useIssuePhoto();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const busy = saving || photo.step !== 'idle';

  async function save() {
    setSaved(false);
    const path = await photo.upload();
    if (!path) return;
    setSaving(true);
    const r = await replaceIssuePhotoAction(issueId, path);
    setSaving(false);
    if (!r.ok) {
      photo.setError(r.message ?? null);
      return;
    }
    photo.clear();
    setSaved(true);
    router.refresh();
  }

  return (
    <div className={styles.field}>
      <span className={styles.label} id="issue-photo-label">
        {t.photo}
      </span>
      {photo.photo ? (
        <img src={photo.photo.url} alt="" className={styles.receiptPreview} />
      ) : (
        photoUrl && <img src={photoUrl} alt={t.photo} className={styles.receiptPreview} />
      )}
      <label className={photo.photo || photoUrl ? `${styles.picker} ${styles.pickerCompact}` : styles.picker}>
        <input
          type="file"
          accept="image/*,.heic,.heif"
          className={styles.visuallyHidden}
          aria-labelledby="issue-photo-label"
          disabled={busy}
          onChange={(e) => void photo.pick(e.target.files?.[0])}
        />
        {photoUrl || photo.photo ? t.photoReplace : t.photoAdd}
      </label>
      {photo.photo && (
        <button type="button" className={styles.secondary} onClick={() => void save()} disabled={busy}>
          {t.photoSave}
        </button>
      )}
      {photo.stepText && (
        <p role="status" className={styles.hint}>
          {photo.stepText}
        </p>
      )}
      {saved && (
        <p role="status" className={styles.info}>
          {t.photoSaved}
        </p>
      )}
      {photo.error && (
        <p role="alert" className={styles.fieldError}>
          {photo.error}
        </p>
      )}
    </div>
  );
}
