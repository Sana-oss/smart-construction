'use client';

// Deleting a photo cannot be undone (the file is removed too), so the browser asks first.

import { deletePhotoAction } from './actions';
import { photosTextAr } from './messages.ar';
import styles from './photos.module.css';

export function DeletePhotoButton({ photoId, label }: { photoId: string; label: string }) {
  return (
    <form
      action={deletePhotoAction.bind(null, photoId)}
      onSubmit={(e) => {
        if (!window.confirm(photosTextAr.gallery.deleteConfirm)) e.preventDefault();
      }}
    >
      <button type="submit" className={styles.smallButton} aria-label={label}>
        {photosTextAr.gallery.delete}
      </button>
    </form>
  );
}
