'use client';

// Sign-in form (FR-ID-01). Design: Design/Screens/screen (2).png.
// The form posts to signInAction (a Server Action), so it also works before JavaScript loads.
// Validation and Supabase errors come back as Arabic messages per field or for the whole form.

import { useActionState } from 'react';
import { signInAction, type AuthFormState } from './actions';
import { signInTextAr as t } from './messages.ar';
import styles from './auth.module.css';

const initialState: AuthFormState = {};

export function SignInForm() {
  const [state, formAction, pending] = useActionState(signInAction, initialState);
  const phoneError = state.fieldErrors?.phone;
  const passwordError = state.fieldErrors?.password;

  return (
    <form action={formAction} className={styles.form} noValidate>
      {state.formError && (
        <p role="alert" className={styles.formError}>
          {state.formError}
        </p>
      )}

      <div className={styles.field}>
        <label htmlFor="phone" className={styles.label}>
          {t.phoneLabel}
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
          {t.passwordLabel}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
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

      <button type="submit" className={styles.primaryButton} disabled={pending}>
        {pending ? t.submitting : t.submit}
      </button>
    </form>
  );
}
