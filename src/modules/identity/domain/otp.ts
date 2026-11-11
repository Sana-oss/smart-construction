// The SMS verification code, used only if phone confirmation is turned on (decision pending, change register §4).
// Supabase Auth sends a 6-digit code by default ("Phone sign-in" guide); if the project setting changes, change it here.
export const OTP_LENGTH = 6;

export type OtpResult = { ok: true; value: string } | { ok: false; error: 'otp_required' | 'otp_invalid' };

export function normalizeOtp(input: string): OtpResult {
  const digits = (input ?? '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\s/g, '');
  if (digits === '') return { ok: false, error: 'otp_required' };
  return new RegExp(`^\\d{${OTP_LENGTH}}$`).test(digits) ? { ok: true, value: digits } : { ok: false, error: 'otp_invalid' };
}
