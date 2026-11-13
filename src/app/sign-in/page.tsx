import { redirect } from 'next/navigation';
import { getSignedInUserId, HOME_PATH, SignInForm, signInTextAr as t } from '@/modules/identity';
import styles from '@/app/auth-screen.module.css';

export const metadata = { title: `${t.pageTitle} · ركيزة` };

// Sign-in page (FR-ID-01). Thin route: layout here, logic in the identity module.
export default async function SignInPage() {
  // Already signed in: nothing to do here.
  if (await getSignedInUserId()) redirect(HOME_PATH);

  return (
    <main className={styles.screen}>
      <img src="/brand/logo-mark-white.svg" alt={t.logoAlt} className={styles.logo} width={112} height={84} />
      <header>
        <h1 className={styles.heading}>{t.heading}</h1>
        <p className={styles.intro}>{t.intro}</p>
      </header>
      <SignInForm />
    </main>
  );
}
