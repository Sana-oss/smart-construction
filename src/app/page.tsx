import { getSignedInUserId, sessionTextAr as t, SignOutButton, WelcomeScreen } from '@/modules/identity';
import styles from '@/app/auth-screen.module.css';

// Home.
// - Not signed in: the welcome screen (design S01.1), with "sign in" and "create account".
// - Signed in: temporary view (session state + sign-out) until the project dashboard (FR-DSH-01, design S07.1).
export default async function Home() {
  const userId = await getSignedInUserId();
  if (!userId) return <WelcomeScreen />;

  return (
    <main className={styles.screen}>
      <img src="/brand/logo-mark-white.svg" alt="" className={styles.logo} width={56} height={42} />
      <p className={styles.intro}>{t.signedInAs}</p>
      <SignOutButton />
    </main>
  );
}
