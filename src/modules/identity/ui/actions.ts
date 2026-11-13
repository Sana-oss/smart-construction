'use server';

// Server Actions for the sign-up / sign-in / sign-out pages (FR-ID-01).
// Built to be used with React's useActionState: each action receives the previous state and the form data,
// and returns a new state with Arabic messages, or redirects on success.
// They run only on the server, as the user, under RLS (no service-role key).

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@/platform/supabase/server';
import type { CredentialsField } from '../domain/credentials';
import { signIn, signOut, signUp, verifyPhone, type AuthResult } from '../application/auth-use-cases';
import { supabaseAuthGateway } from '../infra/supabase-auth-gateway';
import { failureMessagesAr, fieldMessagesAr } from './messages.ar';
import { AFTER_SIGN_UP_PATH, HOME_PATH, SIGN_IN_PATH } from './routes';

export interface AuthFormState {
  /** Message per field, shown under the input. */
  fieldErrors?: Partial<Record<CredentialsField, string>>;
  /** Message for the whole form (wrong password, rate limit, ...). */
  formError?: string;
  /** Sign-up succeeded but the phone must be confirmed with an SMS code. The page then shows the code step. */
  needsVerification?: { phone: string };
}

const text = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === 'string' ? v : '';
};

async function gateway() {
  return supabaseAuthGateway(await createServerSupabase());
}

/** Turns a failed result into page state. Successful results are handled by each action. */
function toState(result: Extract<AuthResult, { ok: false }>): AuthFormState {
  if ('fieldErrors' in result) {
    const fieldErrors: AuthFormState['fieldErrors'] = {};
    for (const e of result.fieldErrors) fieldErrors[e.field] ??= fieldMessagesAr[e.code]; // first error per field
    return { fieldErrors };
  }
  return { formError: failureMessagesAr[result.failure] };
}

export async function signUpAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const result = await signUp(await gateway(), {
    phone: text(form, 'phone'),
    password: text(form, 'password'),
    fullName: text(form, 'fullName'),
    // FR-ID-06. Form field names: nationality ("libyan" | "foreign"), nationalId, passportNumber.
    nationality: text(form, 'nationality'),
    nationalId: text(form, 'nationalId'),
    passportNumber: text(form, 'passportNumber'),
  });
  if (!result.ok) return toState(result);
  if (result.next === 'needs_verification') return { needsVerification: { phone: result.phone } };

  revalidatePath('/', 'layout');
  redirect(AFTER_SIGN_UP_PATH);
}

export async function verifyPhoneAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const phone = text(form, 'phone');
  const result = await verifyPhone(await gateway(), { phone, code: text(form, 'code') });
  if (!result.ok) return { ...toState(result), needsVerification: { phone } };

  revalidatePath('/', 'layout');
  redirect(AFTER_SIGN_UP_PATH);
}

export async function signInAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const result = await signIn(await gateway(), { phone: text(form, 'phone'), password: text(form, 'password') });
  if (!result.ok) {
    // An unconfirmed account goes to the code step instead of a dead end.
    if ('failure' in result && result.failure === 'phone_not_confirmed') {
      return { ...toState(result), needsVerification: { phone: text(form, 'phone') } };
    }
    return toState(result);
  }

  revalidatePath('/', 'layout');
  redirect(HOME_PATH);
}

export async function signOutAction(): Promise<void> {
  await signOut(await gateway());
  revalidatePath('/', 'layout');
  redirect(SIGN_IN_PATH);
}
