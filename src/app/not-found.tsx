// Shown by Next.js for an address that matches no page (NFR-USE-04: Arabic instead of the default English 404).

import Link from 'next/link';
import { notFoundTextAr as t } from './messages.ar';
import styles from './status.module.css';

export const metadata = { title: `${t.pageTitle} · ركيزة` };

export default function NotFound() {
  return (
    <main className={styles.screen}>
      <h1 className={styles.title}>{t.heading}</h1>
      <p className={styles.body}>{t.body}</p>
      <div className={styles.actions}>
        <Link href="/" className={styles.primary}>
          {t.home}
        </Link>
      </div>
    </main>
  );
}
