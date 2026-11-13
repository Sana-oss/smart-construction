import Link from 'next/link';
import { getSignedInUserId, sessionTextAr as t, SignOutButton, SIGN_IN_PATH } from '@/modules/identity';
import styles from '@/app/auth-screen.module.css';

// Home. Temporary until the project dashboard (FR-DSH-01, design S07.1) is built:
// it only shows whether you are signed in, so the sign-in / sign-out flow can be tried end to end.
export default async function Home() {
  const userId = await getSignedInUserId();

  return (
    <main className={styles.screen}>
      <img src="/brand/logo-mark-white.svg" alt="" className={styles.logo} width={112} height={84} />
      {userId ? (
        <>
          <p className={styles.intro}>{t.signedInAs}</p>
          <SignOutButton />
        </>
      ) : (
        <>
          <p className={styles.intro}>{t.signedOut}</p>
          <Link href={SIGN_IN_PATH}>{t.signIn}</Link>
        </>
      )}
    </main>
  );
}
