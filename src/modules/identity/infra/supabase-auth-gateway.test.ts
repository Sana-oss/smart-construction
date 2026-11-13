import { describe, expect, it } from 'vitest';
import { mapAuthError } from './supabase-auth-gateway';

describe('mapAuthError', () => {
  it.each([
    ['phone_exists', 'phone_taken'],
    ['email_exists', 'phone_taken'],
    ['email_not_confirmed', 'phone_not_confirmed'],
    ['email_provider_disabled', 'phone_auth_disabled'],
    ['user_already_exists', 'phone_taken'],
    ['invalid_credentials', 'invalid_credentials'],
    ['phone_not_confirmed', 'phone_not_confirmed'],
    ['otp_expired', 'otp_rejected'],
    ['over_sms_send_rate_limit', 'rate_limited'],
    ['phone_provider_disabled', 'phone_auth_disabled'],
    ['sms_send_failed', 'sms_failed'],
    ['weak_password', 'weak_password'],
  ] as const)('maps %s to %s', (code, expected) => {
    expect(mapAuthError({ code, status: 400 })).toBe(expected);
  });

  it('treats HTTP 429 without a known code as rate limiting', () => {
    expect(mapAuthError({ code: undefined, status: 429 })).toBe('rate_limited');
  });

  it('never leaks unknown errors', () => {
    expect(mapAuthError({ code: 'unexpected_failure', status: 500 })).toBe('auth_unavailable');
  });
});

describe('mapAuthError: sign-up refused by the database trigger (FR-ID-06)', () => {
  it('maps a trigger failure to identity_document_rejected', () => {
    expect(
      mapAuthError({ code: 'unexpected_failure', status: 500, message: 'Database error saving new user' }),
    ).toBe('identity_document_rejected');
  });
  it('keeps other unexpected failures generic', () => {
    expect(mapAuthError({ code: 'unexpected_failure', status: 500, message: 'something else' })).toBe('auth_unavailable');
  });
});
