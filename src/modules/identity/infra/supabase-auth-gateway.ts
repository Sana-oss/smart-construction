import type { AuthError, SupabaseClient } from '@supabase/supabase-js';
import type { AuthFailure, AuthGateway, SignInOutcome } from '../application/auth-gateway';

/**
 * Translates Supabase Auth error codes into our own failure reasons.
 * Anything we do not recognise becomes 'auth_unavailable', so a new Supabase error never leaks raw text to users.
 * Codes: @supabase/auth-js ErrorCode.
 */
export function mapAuthError(error: Pick<AuthError, 'code' | 'status'> & { message?: string }): AuthFailure {
  // The sign-up trigger (migration 0005) aborts the sign-up when the identity number is already registered.
  // Supabase reports any trigger failure the same way, and our form already validated the number's format,
  // so at sign-up this almost always means "number already registered".
  if (error.code === 'unexpected_failure' && /database error saving new user/i.test(error.message ?? '')) {
    return 'identity_document_rejected';
  }
  switch (error.code) {
    case 'phone_exists':
    case 'user_already_exists':
      return 'phone_taken';
    case 'invalid_credentials':
      return 'invalid_credentials';
    case 'phone_not_confirmed':
      return 'phone_not_confirmed';
    case 'otp_expired':
      return 'otp_rejected';
    case 'over_request_rate_limit':
    case 'over_sms_send_rate_limit':
      return 'rate_limited';
    case 'phone_provider_disabled':
    case 'signup_disabled':
      return 'phone_auth_disabled';
    case 'sms_send_failed':
      return 'sms_failed';
    case 'weak_password':
      return 'weak_password';
    default:
      return error.status === 429 ? 'rate_limited' : 'auth_unavailable';
  }
}

export function supabaseAuthGateway(supabase: SupabaseClient): AuthGateway {
  const failed = (error: AuthError): SignInOutcome => ({ status: 'failed', reason: mapAuthError(error) });

  return {
    async signUp({ phone, password, fullName, identityDocument }) {
      const { data, error } = await supabase.auth.signUp({
        phone,
        password,
        // Read by the sign-up trigger (migrations 0003 and 0005) to fill the profile.
        // Only the document that matches the nationality is sent.
        options: {
          data: {
            full_name: fullName,
            nationality: identityDocument.nationality,
            ...(identityDocument.nationality === 'libyan'
              ? { national_id: identityDocument.nationalId }
              : { passport_number: identityDocument.passportNumber }),
          },
        },
      });
      if (error) return failed(error);
      // With phone confirmation on, Supabase returns a user but no session until the SMS code is verified.
      return data.session ? { status: 'signed_in' } : { status: 'needs_verification' };
    },

    async signIn({ phone, password }) {
      const { error } = await supabase.auth.signInWithPassword({ phone, password });
      return error ? failed(error) : { status: 'signed_in' };
    },

    async verifyPhone(phone, code) {
      const { data, error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' });
      if (error) return failed(error);
      return data.session ? { status: 'signed_in' } : { status: 'failed', reason: 'auth_unavailable' };
    },

    async signOut() {
      // Errors are ignored on purpose: signing out must always clear the local session.
      await supabase.auth.signOut();
    },
  };
}
