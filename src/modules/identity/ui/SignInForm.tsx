'use client';

// Sign-in screen (FR-ID-01). Design: teammate's v2 screen S01.2 (https://rakeeza-ux-review-v2.vercel.app/#S01.2).
// The form posts to signInAction (a Server Action), so it also works before JavaScript loads.
// Validation and Supabase errors come back as Arabic messages per field or for the whole form.

import Link from 'next/link';
import { useActionState } from 'react';
import { signInAction, type AuthFormState } from './actions';
import { signInTextAr as t } from './messages.ar';
import { SIGN_UP_PATH } from './routes';
import styles from './auth.module.css';

const initialState: AuthFormState = {};
const FORM_ID = 'sign-in-form';

export function SignInForm() {
  const [state, formAction, pending] = useActionState(signInAction, initialState);
  const phoneError = state.fieldErrors?.phone;
  const passwordError = state.fieldErrors?.password;

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t.heading}</h1>
        <p className={styles.subtitle}>{t.intro}</p>
      </header>

      <div className={styles.scroll}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>
            <img src="/brand/logo-mark-white.svg" alt={t.logoAlt} width={44} height={33} />
          </span>
          <strong className={styles.brandName}>{t.brandName}</strong>
          <p className={styles.tagline}>{t.tagline}</p>
        </div>

        <form id={FORM_ID} action={formAction} noValidate>
          {state.formError && (
            <p role="alert" className={styles.errorSummary}>
              {state.formError}
            </p>
          )}
          <p className={styles.hint}>{t.requiredHint}</p>

          <div className={styles.field}>
            <label htmlFor="phone" className={styles.label}>
              {t.phoneLabel} <span aria-hidden="true">*</span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              placeholder={t.phonePlaceholder}
              defaultValue={state.values?.phone ?? ''}
              required
              className={styles.input}
              aria-invalid={phoneError ? true : undefined}
              aria-describedby={phoneError ? 'phone-error' : undefined}
            />
            {phoneError && (
              <p id="phone-error" className={styles.fieldError}>
                {phoneError}
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="password" className={styles.label}>
              {t.passwordLabel} <span aria-hidden="true">*</span>
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              dir="ltr"
              required
              className={styles.input}
              aria-invalid={passwordError ? true : undefined}
              aria-describedby={passwordError ? 'password-error' : undefined}
            />
            {passwordError && (
              <p id="password-error" className={styles.fieldError}>
                {passwordError}
              </p>
            )}
          </div>
        </form>
      </div>

      {/* Buttons sit at the bottom of the screen (thumb reach); `form` links the submit button to the form above. */}
      <div className={styles.actions}>
        <button type="submit" form={FORM_ID} className={styles.primary} disabled={pending}>
          {pending ? t.submitting : t.submit}
        </button>
        <Link href={SIGN_UP_PATH} className={styles.secondary}>
          {t.createAccount}
        </Link>
      </div>
    </main>
  );
}
