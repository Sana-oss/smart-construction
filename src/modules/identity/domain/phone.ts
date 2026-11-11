// Libyan mobile numbers (FR-ID-01: sign-up and sign-in by phone number + password).
//
// Format (source: "Telephone numbers in Libya", Wikipedia, checked 12 Nov 2026):
//   national 09X XXX XXXX, international +218 9X XXX XXXX.
//   Prefixes: 91, 93 (Al-Madar), 92, 94 (Libyana), 95 (LibyaPhone / LTT).
// Sources disagree on extra prefixes (e.g. 96). This list is DATA: if an operator adds a prefix,
// add it here only, with its source. The rest of the code does not change.
export const LIBYAN_MOBILE_PREFIXES = ['91', '92', '93', '94', '95'] as const;

const COUNTRY_CODE = '218';
const SUBSCRIBER_DIGITS = 7; // after the 2-digit prefix

export type PhoneError = 'phone_required' | 'phone_invalid';
export type PhoneResult = { ok: true; value: string } | { ok: false; error: PhoneError };

// Owners type on Arabic keyboards, so accept Arabic-Indic (٠-٩) and Persian (۰-۹) digits too.
function toAsciiDigits(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/**
 * Normalizes any common way of writing a Libyan mobile number to E.164 (+2189XXXXXXXX),
 * which is the form Supabase Auth stores. Accepts: 0912345678, 912345678, +218912345678,
 * 00218912345678, 218912345678, with spaces, dashes, dots or parentheses.
 */
export function normalizeLibyanMobile(input: string): PhoneResult {
  const raw = toAsciiDigits(input ?? '').trim();
  if (raw === '') return { ok: false, error: 'phone_required' };

  // A "+" is only allowed at the very start; everything else must be a digit or a separator.
  if (!/^\+?[\d\s\-.()]+$/.test(raw)) return { ok: false, error: 'phone_invalid' };

  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00' + COUNTRY_CODE)) digits = digits.slice(2 + COUNTRY_CODE.length);
  else if (digits.startsWith(COUNTRY_CODE)) digits = digits.slice(COUNTRY_CODE.length);
  else if (digits.startsWith('0')) digits = digits.slice(1);

  const prefix = digits.slice(0, 2);
  const valid =
    digits.length === 2 + SUBSCRIBER_DIGITS &&
    (LIBYAN_MOBILE_PREFIXES as readonly string[]).includes(prefix);

  return valid ? { ok: true, value: `+${COUNTRY_CODE}${digits}` } : { ok: false, error: 'phone_invalid' };
}
