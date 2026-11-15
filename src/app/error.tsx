'use client';

// Shown by Next.js when a page or a Server Component throws (for example the database is unreachable).
// Without this file the user would see Next's default English error (NFR-USE-04).
// The technical error is NOT shown: on the server it is already in the logs, and in production Next.js
// replaces its message anyway. `reset` asks Next.js to render the page again.

import Link from 'next/link';
import { errorPageTextAr as t } from './messages.ar';
import styles from './status.module.css';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className={styles.screen}>
      <h1 className={styles.title}>{t.heading}</h1>
      <p role="alert" className={styles.body}>
        {t.body}
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={reset}>
          {t.retry}
        </button>
        <Link href="/" className={styles.secondary}>
          {t.home}
        </Link>
      </div>
    </main>
  );
}
