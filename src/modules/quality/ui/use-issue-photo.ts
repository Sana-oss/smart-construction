'use client';

// The defect photo in the browser: compressed when picked (HEIC converted), uploaded only when the form is sent, with a
// one-time token (prepareIssuePhotoUploadAction), like the receipt and checklist photos.

import { useEffect, useState } from 'react';
import { checkPickedImage } from '@/shared-kernel';
import { compressImage } from '@/platform/images/compress-image';
import { createBrowserSupabase } from '@/platform/supabase/browser';
import { PROJECT_FILES_BUCKET } from '@/platform/supabase/storage';
import { prepareIssuePhotoUploadAction } from './issue-actions';
import { checklistTextAr } from './messages.ar';

const t = checklistTextAr.item;
export type PhotoStep = 'idle' | 'preparing' | 'converting' | 'uploading';

export function useIssuePhoto() {
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [step, setStep] = useState<PhotoStep>('idle');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => () => void (photo && URL.revokeObjectURL(photo.url)), [photo]);

  async function pick(file: File | undefined) {
    setError(null);
    if (!file) return;
    const problem = checkPickedImage(file);
    if (problem) {
      setError(problem === 'too_large' ? t.photoTooLarge : t.photoNotImage);
      return;
    }
    setStep('preparing');
    const result = await compressImage(file, () => setStep('converting'));
    setStep('idle');
    if (!result.ok) {
      setError(result.reason === 'heicFailed' ? t.photoHeicFailed : t.photoUnreadable);
      return;
    }
    setPhoto({ blob: result.photo.blob, url: URL.createObjectURL(result.photo.blob) });
  }

  /** Uploads the picked photo; its storage path, or null (the error is set). */
  async function upload(): Promise<string | null> {
    if (!photo) return null;
    setStep('uploading');
    const ticket = await prepareIssuePhotoUploadAction();
    if (!ticket.ok) {
      setStep('idle');
      setError(ticket.message);
      return null;
    }
    const r = await createBrowserSupabase()
      .storage.from(PROJECT_FILES_BUCKET)
      .uploadToSignedUrl(ticket.path, ticket.token, photo.blob, { contentType: 'image/jpeg' });
    setStep('idle');
    if (r.error) {
      setError(t.photoUploadFailed);
      return null;
    }
    return ticket.path;
  }

  const stepText = step === 'converting' ? t.photoConverting : step === 'uploading' ? t.photoUploading : step === 'preparing' ? t.photoPreparing : null;
  return { photo, clear: () => setPhoto(null), pick, upload, step, stepText, error, setError };
}
