'use client';

// Sign-out (FR-ID-01). A form posting to signOutAction, which clears the session and goes to the sign-in page.

import { useFormStatus } from 'react-dom';
import { signOutAction } from './actions';
import { sessionTextAr as t } from './messages.ar';
import styles from './auth.module.css';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={styles.linkButton} disabled={pending}>
      {pending ? t.signingOut : t.signOut}
    </button>
  );
}

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Submit />
    </form>
  );
}
