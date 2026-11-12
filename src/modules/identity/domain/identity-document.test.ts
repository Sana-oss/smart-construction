import { describe, expect, it } from 'vitest';
import { normalizeNationalId, normalizePassportNumber, validateIdentityDocument } from './identity-document';

const today = new Date('2026-11-12T00:00:00Z');

describe('normalizeNationalId (Law 8/2014)', () => {
  it.each([
    ['119850012345', '119850012345'], // male, born 1985
    ['220010000017', '220010000017'], // female, born 2001
    ['1 1985 001234 5', '119850012345'], // spaces
    ['١١٩٨٥٠٠١٢٣٤٥', '119850012345'], // Arabic-Indic digits
  ])('accepts %s', (input, expected) => {
    expect(normalizeNationalId(input, today)).toBe(expected);
  });

  it.each([
    ['11985001234', 'too short (11 digits)'],
    ['1198500123456', 'too long (13 digits)'],
    ['319850012345', 'first digit not 1 or 2'],
    ['118990012345', 'birth year before 1900'],
    ['120300012345', 'birth year in the future'],
    ['11985001234A', 'letter'],
  ])('rejects %s (%s)', (input) => {
    expect(normalizeNationalId(input, today)).toBeNull();
  });
});

describe('normalizePassportNumber', () => {
  it('upper-cases and strips spaces and dashes', () => {
    expect(normalizePassportNumber(' ab-123 456 ')).toBe('AB123456');
  });
  it.each(['AB12', 'A'.repeat(21), 'AB12345!', 'جواز123456'])('rejects %s', (input) => {
    expect(normalizePassportNumber(input)).toBeNull();
  });
});

describe('validateIdentityDocument', () => {
  it('Libyan: keeps the national number and ignores any passport', () => {
    expect(
      validateIdentityDocument({ nationality: 'libyan', nationalId: '119850012345', passportNumber: 'AB123456' }, today),
    ).toEqual({ ok: true, value: { nationality: 'libyan', nationalId: '119850012345' } });
  });

  it('foreigner: keeps the passport and ignores any national number', () => {
    expect(
      validateIdentityDocument({ nationality: 'foreign', passportNumber: 'p1234567', nationalId: '119850012345' }, today),
    ).toEqual({ ok: true, value: { nationality: 'foreign', passportNumber: 'P1234567' } });
  });

  it.each([
    [{}, 'nationality', 'nationality_required'],
    [{ nationality: 'other' }, 'nationality', 'nationality_required'],
    [{ nationality: 'libyan' }, 'nationalId', 'national_id_required'],
    [{ nationality: 'libyan', nationalId: '123' }, 'nationalId', 'national_id_invalid'],
    [{ nationality: 'foreign', passportNumber: '  ' }, 'passportNumber', 'passport_required'],
    [{ nationality: 'foreign', passportNumber: 'AB1' }, 'passportNumber', 'passport_invalid'],
  ])('reports %j as %s/%s', (input, field, code) => {
    expect(validateIdentityDocument(input, today)).toEqual({ ok: false, error: { field, code } });
  });
});
