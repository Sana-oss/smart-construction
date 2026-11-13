// Phone number as the login, without an SMS provider (decision 13 Nov 2026, change register).
//
// Why: Supabase only enables its Phone provider with an SMS provider account (Twilio, Vonage, ...), and the free
// Twilio trial is not available in Libya. So each Libyan mobile number is turned into a fixed internal login name
// and the account uses Supabase's email/password sign-in, with email confirmation OFF. Users only ever see and type
// their phone number.
//
// The domain ends in ".invalid", a name reserved by the internet standards (RFC 2606) so that it can never receive
// mail: no email can ever be sent to these login names, by us or by anyone else.
//
// Known limitation (documented): the phone number is not verified by SMS. When an SMS provider becomes available,
// existing accounts are migrated by copying each number into Supabase's phone field (it is also kept in the
// user's metadata at sign-up for exactly that purpose).

export const LOGIN_EMAIL_DOMAIN = 'phone.rakeeza.invalid';

const E164_LIBYAN_MOBILE = /^\+218(9[0-9]{8})$/;

/**
 * +218912345678 -> 218912345678@phone.rakeeza.invalid
 * Takes the E.164 form produced by normalizeLibyanMobile, so the same phone always gives the same login name
 * however the user typed it (0912..., +218 91..., Arabic digits).
 */
export function loginEmailForPhone(e164Phone: string): string {
  if (!E164_LIBYAN_MOBILE.test(e164Phone)) {
    // Programming error: callers must normalize and validate the phone first.
    throw new Error('loginEmailForPhone expects a normalized Libyan mobile number (+2189XXXXXXXX)');
  }
  return `${e164Phone.slice(1)}@${LOGIN_EMAIL_DOMAIN}`;
}
