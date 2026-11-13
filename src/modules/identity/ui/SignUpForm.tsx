'use client';

// Sign-up screen (FR-ID-01, FR-ID-06).
// Design: teammate's v2 screen S01.3 (https://rakeeza-ux-review-v2.vercel.app/#S01.3): name, phone, password,
// password confirmation. Added by decision (13 Nov): nationality + national number or passport number (FR-ID-06),
// which the design does not have yet. Only the field that matches the chosen nationality is shown and sent.

import Link from 'next/link';
import { useActionState, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { signUpAction, type AuthFormState } from './actions';
import { AuthBrand } from './AuthBrand';
import { signUpTextAr as t } from './messages.ar';
import { HOME_PATH, SIGN_IN_PATH } from './routes';
import styles from './auth.module.css';

const initialState: AuthFormState = {};
const FORM_ID = 'sign-up-form';

type FieldName = 'fullName' | 'phone' | 'nationalId' | 'passportNumber' | 'password' | 'passwordConfirm';

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(signUpAction, initialState);
  const [nationality, setNationality] = useState(state.values?.nationality ?? '');
  const errors = state.fieldErrors ?? {};

  /** One labelled input with its error and optional helper, in the design's .field style. */
  const field = (name: FieldName, label: string, input: InputHTMLAttributes<HTMLInputElement>, helper?: ReactNode) => {
    const error = errors[name];
    const describedBy = [error ? `${name}-error` : '', helper ? `${name}-helper` : ''].filter(Boolean).join(' ');
    return (
      <div className={styles.field}>
        <label htmlFor={name} className={styles.label}>
          {label} <span aria-hidden="true">*</span>
        </label>
        <input
          id={name}
          name={name}
          required
          className={styles.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          {...input}
        />
        {helper && (
          <p id={`${name}-helper`} className={styles.helper}>
            {helper}
          </p>
        )}
        {error && (
          <p id={`${name}-error`} className={styles.fieldError}>
            {error}
          </p>
        )}
      </div>
    );
  };

  return (
    <main className={styles.screen}>
      <header className={`${styles.header} ${styles.headerRow}`}>
        <Link href={HOME_PATH} className={styles.iconButton} aria-label={t.back}>
          {/* Lucide chevron-left turned around: "back" points right in an RTL interface (as in the design). */}
          <svg
            style={{ transform: 'rotate(180deg)' }}
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <div>
          <h1 className={styles.title}>{t.heading}</h1>
          <p className={styles.subtitle}>{t.intro}</p>
        </div>
      </header>

      <div className={styles.scroll}>
        <AuthBrand />

        <form id={FORM_ID} action={formAction} noValidate>
          {state.formError && (
            <p role="alert" className={styles.errorSummary}>
              {state.formError}
            </p>
          )}
          <p className={styles.hint}>{t.requiredHint}</p>

          {field('fullName', t.fullNameLabel, {
            type: 'text',
            autoComplete: 'name',
            defaultValue: state.values?.fullName ?? '',
          })}

          {field('phone', t.phoneLabel, {
            type: 'tel',
            inputMode: 'tel',
            autoComplete: 'tel',
            dir: 'ltr',
            placeholder: t.phonePlaceholder,
            defaultValue: state.values?.phone ?? '',
          })}

          <fieldset
            className={styles.choiceGroup}
            aria-invalid={errors.nationality ? true : undefined}
            aria-describedby={errors.nationality ? 'nationality-error' : undefined}
          >
            <legend className={styles.label}>
              {t.nationalityLabel} <span aria-hidden="true">*</span>
            </legend>
            <div className={styles.choices}>
              {(
                [
                  ['libyan', t.nationalityLibyan],
                  ['foreign', t.nationalityForeign],
                ] as const
              ).map(([value, text]) => (
                <label key={value} className={styles.choice}>
                  <input
                    type="radio"
                    name="nationality"
                    value={value}
                    required
                    // defaultChecked (not checked): React resets the form after each submission, and the reset
                    // restores defaultChecked, so the chosen nationality stays selected after an error.
                    defaultChecked={nationality === value}
                    onChange={() => setNationality(value)}
                  />
                  {text}
                </label>
              ))}
            </div>
            {errors.nationality && (
              <p id="nationality-error" className={styles.fieldError}>
                {errors.nationality}
              </p>
            )}
          </fieldset>

          {nationality === 'libyan' &&
            field(
              'nationalId',
              t.nationalIdLabel,
              { type: 'text', inputMode: 'numeric', autoComplete: 'off', dir: 'ltr', defaultValue: state.values?.nationalId ?? '' },
              `${t.nationalIdHelper} ${t.identityHelper}`,
            )}
          {nationality === 'foreign' &&
            field(
              'passportNumber',
              t.passportLabel,
              { type: 'text', autoComplete: 'off', autoCapitalize: 'characters', dir: 'ltr', defaultValue: state.values?.passportNumber ?? '' },
              t.identityHelper,
            )}

          {field('password', t.passwordLabel, { type: 'password', autoComplete: 'new-password', dir: 'ltr' }, t.passwordHelper)}
          {field('passwordConfirm', t.passwordConfirmLabel, { type: 'password', autoComplete: 'new-password', dir: 'ltr' })}
        </form>
      </div>

      <div className={styles.actions}>
        <button type="submit" form={FORM_ID} className={styles.primary} disabled={pending}>
          {pending ? t.submitting : t.submit}
        </button>
        <Link href={SIGN_IN_PATH} className={styles.secondary}>
          {t.haveAccount}
        </Link>
      </div>
    </main>
  );
}
