import {
  validateSignIn,
  validateSignUp,
  type FieldError,
  type SignInInput,
  type SignUpInput,
} from '../domain/credentials';
import { normalizeLibyanMobile } from '../domain/phone';
import { normalizeOtp } from '../domain/otp';
import type { AuthFailure, AuthGateway } from './auth-gateway';

// Use cases for FR-ID-01. Order is always: validate in the domain (NFR-SEC-04), and call the
// provider only when the input is valid, so invalid input never leaves the server.

export type AuthResult =
  | { ok: true; next: 'signed_in' | 'needs_verification'; phone: string }
  | { ok: false; fieldErrors: FieldError[] }
  | { ok: false; failure: AuthFailure };

export async function signUp(gateway: AuthGateway, input: SignUpInput): Promise<AuthResult> {
  const valid = validateSignUp(input);
  if (!valid.ok) return { ok: false, fieldErrors: valid.errors };

  const outcome = await gateway.signUp(valid.value);
  if (outcome.status === 'failed') return { ok: false, failure: outcome.reason };
  return { ok: true, next: outcome.status, phone: valid.value.phone };
}

export async function signIn(gateway: AuthGateway, input: SignInInput): Promise<AuthResult> {
  const valid = validateSignIn(input);
  if (!valid.ok) return { ok: false, fieldErrors: valid.errors };

  const outcome = await gateway.signIn(valid.value);
  if (outcome.status === 'failed') return { ok: false, failure: outcome.reason };
  return { ok: true, next: 'signed_in', phone: valid.value.phone };
}

export async function verifyPhone(gateway: AuthGateway, input: { phone: string; code: string }): Promise<AuthResult> {
  const fieldErrors: FieldError[] = [];
  const phone = normalizeLibyanMobile(input.phone);
  if (!phone.ok) fieldErrors.push({ field: 'phone', code: phone.error });
  const code = normalizeOtp(input.code);
  if (!code.ok) fieldErrors.push({ field: 'code', code: code.error });
  if (!phone.ok || !code.ok) return { ok: false, fieldErrors };

  const outcome = await gateway.verifyPhone(phone.value, code.value);
  if (outcome.status === 'failed') return { ok: false, failure: outcome.reason };
  return { ok: true, next: 'signed_in', phone: phone.value };
}

export async function signOut(gateway: AuthGateway): Promise<void> {
  await gateway.signOut();
}
