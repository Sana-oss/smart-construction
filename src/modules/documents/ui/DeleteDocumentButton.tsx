'use client';

// Deleting a document cannot be undone (the file is removed too), so the browser asks first.

import { deleteDocumentAction } from './actions';
import { documentsTextAr } from './messages.ar';
import styles from './documents.module.css';

export function DeleteDocumentButton({ documentId, title }: { documentId: string; title: string }) {
  return (
    <form
      action={deleteDocumentAction.bind(null, documentId)}
      onSubmit={(e) => {
        if (!window.confirm(documentsTextAr.list.deleteConfirm(title))) e.preventDefault();
      }}
    >
      <button type="submit" className={styles.smallButton} aria-label={documentsTextAr.list.deleteLabel(title)}>
        {documentsTextAr.list.delete}
      </button>
    </form>
  );
}
