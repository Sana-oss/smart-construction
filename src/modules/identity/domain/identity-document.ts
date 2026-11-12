// Identity document at sign-up (FR-ID-06, decision of 12 Nov 2026).
// Why we collect it: to document contracts and project records with the owner's identity.
// Rule: a Libyan gives the national number; a non-Libyan gives a passport number. One account per number.
//
// Libyan national number, Law No. 8 of 2014, Article 2 (checked 12 Nov 2026):
//   12 digits, read left to right: digit 1 = sex (1 male, 2 female), digits 2–5 = year of birth,
//   digits 6–11 = serial within that year and sex, digit 12 = check digit.
//   The law does not say how the check digit is computed, so it is NOT validated here (we do not guess).
// Passport number: no single world format; project rule = 6 to 20 Latin letters or digits, stored upper-case.
// We never derive sex or birth year from the number (data minimisation): it is stored only as given.

export type Nationality = 'libyan' | 'foreign';

export type IdentityDocument =
  | { nationality: 'libyan'; nationalId: string }
  | { nationality: 'foreign'; passportNumber: string };

export type IdentityDocumentErrorCode =
  | 'nationality_required'
  | 'national_id_required'
  | 'national_id_invalid'
  | 'passport_required'
  | 'passport_invalid';

export type IdentityDocumentField = 'nationality' | 'nationalId' | 'passportNumber';

export interface IdentityDocumentInput {
  nationality?: string | null;
  nationalId?: string | null;
  passportNumber?: string | null;
}

export type IdentityDocumentResult =
  | { ok: true; value: IdentityDocument }
  | { ok: false; error: { field: IdentityDocumentField; code: IdentityDocumentErrorCode } };

const NATIONAL_ID_LENGTH = 12;
const EARLIEST_BIRTH_YEAR = 1900; // sanity bound for digits 2–5, not a legal rule
export const PASSPORT_MIN_LENGTH = 6;
export const PASSPORT_MAX_LENGTH = 20;

function toAsciiDigits(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/** Validates the structure from Law 8/2014: 12 digits, sex digit 1 or 2, a plausible birth year. */
export function normalizeNationalId(input: string, today: Date = new Date()): string | null {
  const digits = toAsciiDigits(input).replace(/[\s-]/g, '');
  if (!new RegExp(`^\\d{${NATIONAL_ID_LENGTH}}$`).test(digits)) return null;
  if (digits[0] !== '1' && digits[0] !== '2') return null;
  const birthYear = Number(digits.slice(1, 5));
  if (birthYear < EARLIEST_BIRTH_YEAR || birthYear > today.getFullYear()) return null;
  return digits;
}

export function normalizePassportNumber(input: string): string | null {
  const value = toAsciiDigits(input).replace(/[\s-]/g, '').toUpperCase();
  return new RegExp(`^[A-Z0-9]{${PASSPORT_MIN_LENGTH},${PASSPORT_MAX_LENGTH}}$`).test(value) ? value : null;
}

/**
 * Only the document that matches the nationality is kept: a Libyan's passport number (or a foreigner's
 * national number) is ignored even if the form sent one, so we never store more than we need.
 */
export function validateIdentityDocument(input: IdentityDocumentInput, today: Date = new Date()): IdentityDocumentResult {
  const fail = (field: IdentityDocumentField, code: IdentityDocumentErrorCode): IdentityDocumentResult => ({
    ok: false,
    error: { field, code },
  });

  if (input.nationality === 'libyan') {
    const raw = (input.nationalId ?? '').trim();
    if (raw === '') return fail('nationalId', 'national_id_required');
    const nationalId = normalizeNationalId(raw, today);
    return nationalId ? { ok: true, value: { nationality: 'libyan', nationalId } } : fail('nationalId', 'national_id_invalid');
  }

  if (input.nationality === 'foreign') {
    const raw = (input.passportNumber ?? '').trim();
    if (raw === '') return fail('passportNumber', 'passport_required');
    const passportNumber = normalizePassportNumber(raw);
    return passportNumber
      ? { ok: true, value: { nationality: 'foreign', passportNumber } }
      : fail('passportNumber', 'passport_invalid');
  }

  return fail('nationality', 'nationality_required');
}
