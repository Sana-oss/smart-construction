// Welcome screen for visitors who are not signed in (FR-ID-01).
// Design: teammate's v2 screen S01.1 (https://rakeeza-ux-review-v2.vercel.app/#S01.1),
// which replaces the old Design/Screens/screen (1).png.

import Link from 'next/link';
import { AuthBrand } from './AuthBrand';
import { welcomeTextAr as t } from './messages.ar';
import { SIGN_IN_PATH, SIGN_UP_PATH } from './routes';
import styles from './auth.module.css';

export function WelcomeScreen() {
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t.heading}</h1>
        <p className={styles.subtitle}>{t.intro}</p>
      </header>

      <div className={styles.scroll}>
        <AuthBrand />
        <p className={styles.info}>{t.info}</p>
      </div>

      <div className={styles.actions}>
        <Link href={SIGN_IN_PATH} className={styles.primary}>
          {t.signIn}
        </Link>
        <Link href={SIGN_UP_PATH} className={styles.secondary}>
          {t.createAccount}
        </Link>
      </div>
    </main>
  );
}
