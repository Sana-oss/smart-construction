import type { SignInData, SignUpData } from '../domain/credentials';

// Port: what the use cases need from an auth provider, in our own words.
// The Supabase adapter (infra/supabase-auth-gateway.ts) implements it; tests use a fake.
// Keeping Supabase error codes out of here means the use cases and the UI never depend on Supabase.

export type AuthFailure =
  | 'phone_taken'
  | 'invalid_credentials'
  | 'phone_not_confirmed'
  | 'otp_rejected'
  | 'rate_limited'
  | 'phone_auth_disabled'
  | 'sms_failed'
  | 'weak_password'
  | 'identity_document_rejected' // usually: national number / passport already registered (FR-ID-06)
  | 'auth_unavailable';

export type SignUpOutcome =
  | { status: 'signed_in' }
  | { status: 'needs_verification' } // phone confirmation on: Supabase sent an SMS code, no session yet
  | { status: 'failed'; reason: AuthFailure };

export type SignInOutcome = { status: 'signed_in' } | { status: 'failed'; reason: AuthFailure };

export interface AuthGateway {
  signUp(data: SignUpData): Promise<SignUpOutcome>;
  signIn(data: SignInData): Promise<SignInOutcome>;
  verifyPhone(phone: string, code: string): Promise<SignInOutcome>;
  signOut(): Promise<void>;
}
