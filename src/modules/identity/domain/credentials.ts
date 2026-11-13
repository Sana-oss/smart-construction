import { normalizeLibyanMobile, type PhoneError } from './phone';
import type { OtpResult } from './otp';
import {
  validateIdentityDocument,
  type IdentityDocument,
  type IdentityDocumentErrorCode,
  type IdentityDocumentField,
} from './identity-document';

type OtpError = Extract<OtpResult, { ok: false }>['error'];

// Input rules for sign-up and sign-in (FR-ID-01, NFR-SEC-04: validate at every boundary).
// Rules are project decisions recorded in docs/project_change_register.md (12 Nov 2026).
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72; // bcrypt (used by Supabase Auth) ignores bytes beyond 72
export const FULL_NAME_MAX_LENGTH = 100;

export type CredentialsErrorCode =
  | PhoneError
  | OtpError
  | IdentityDocumentErrorCode
  | 'password_required'
  | 'password_too_short'
  | 'password_too_long'
  | 'password_mismatch'
  | 'full_name_required'
  | 'full_name_too_long';

export type CredentialsField = 'phone' | 'password' | 'passwordConfirm' | 'fullName' | 'code' | IdentityDocumentField;
export interface FieldError {
  field: CredentialsField;
  code: CredentialsErrorCode;
}

export interface SignUpInput {
  phone: string;
  password: string;
  /** Must equal password (design S01.3: «تأكيد كلمة المرور»). */
  passwordConfirm: string;
  /** Required (design S01.3, decision 13 Nov). */
  fullName: string;
  /** 'libyan' or 'foreign' (FR-ID-06). */
  nationality?: string | null;
  nationalId?: string | null;
  passportNumber?: string | null;
}
export interface SignUpData {
  phone: string; // E.164
  password: string;
  fullName: string;
  identityDocument: IdentityDocument;
}
export interface SignInInput {
  phone: string;
  password: string;
}
export interface SignInData {
  phone: string; // E.164
  password: string;
}

export type Validation<T> = { ok: true; value: T } | { ok: false; errors: FieldError[] };

function checkPassword(password: string, errors: FieldError[]) {
  // Passwords are never trimmed: spaces are legitimate characters.
  if (!password) errors.push({ field: 'password', code: 'password_required' });
  else if ([...password].length < PASSWORD_MIN_LENGTH) errors.push({ field: 'password', code: 'password_too_short' });
  else if (new TextEncoder().encode(password).length > PASSWORD_MAX_LENGTH)
    errors.push({ field: 'password', code: 'password_too_long' });
}

export function validateSignUp(input: SignUpInput, today: Date = new Date()): Validation<SignUpData> {
  const errors: FieldError[] = [];
  const phone = normalizeLibyanMobile(input.phone);
  if (!phone.ok) errors.push({ field: 'phone', code: phone.error });
  checkPassword(input.password ?? '', errors);
  // Compared exactly (no trimming), like the password itself.
  if (input.password && input.passwordConfirm !== input.password) {
    errors.push({ field: 'passwordConfirm', code: 'password_mismatch' });
  }

  const name = (input.fullName ?? '').trim().replace(/\s+/g, ' ');
  if (name === '') errors.push({ field: 'fullName', code: 'full_name_required' });
  else if ([...name].length > FULL_NAME_MAX_LENGTH) errors.push({ field: 'fullName', code: 'full_name_too_long' });

  const document = validateIdentityDocument(input, today);
  if (!document.ok) errors.push(document.error);

  if (errors.length > 0 || !phone.ok || !document.ok) return { ok: false, errors };
  return {
    ok: true,
    value: {
      phone: phone.value,
      password: input.password,
      fullName: name,
      identityDocument: document.value,
    },
  };
}

/**
 * Sign-in only checks that both fields are present and the phone is well-formed.
 * Length rules are NOT applied here: an account created under older rules must still be able to sign in,
 * and the server decides whether the password is right.
 */
export function validateSignIn(input: SignInInput): Validation<SignInData> {
  const errors: FieldError[] = [];
  const phone = normalizeLibyanMobile(input.phone);
  if (!phone.ok) errors.push({ field: 'phone', code: phone.error });
  if (!input.password) errors.push({ field: 'password', code: 'password_required' });

  if (errors.length > 0 || !phone.ok) return { ok: false, errors };
  return { ok: true, value: { phone: phone.value, password: input.password } };
}
