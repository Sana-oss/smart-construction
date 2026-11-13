import { redirect } from 'next/navigation';
import { getSignedInUserId, HOME_PATH, SignUpForm, signUpTextAr as t } from '@/modules/identity';

export const metadata = { title: `${t.pageTitle} · ركيزة` };

// Sign-up page (FR-ID-01, FR-ID-06). Thin route: the whole screen lives in the identity module.
export default async function SignUpPage() {
  if (await getSignedInUserId()) redirect(HOME_PATH);
  return <SignUpForm />;
}
