import { redirect } from 'next/navigation';
import { getSignedInUserId, HOME_PATH, SignInForm, signInTextAr as t } from '@/modules/identity';

export const metadata = { title: `${t.pageTitle} · ركيزة` };

// Sign-in page (FR-ID-01). Thin route: the whole screen lives in the identity module.
export default async function SignInPage() {
  // Already signed in: nothing to do here.
  if (await getSignedInUserId()) redirect(HOME_PATH);
  return <SignInForm />;
}
