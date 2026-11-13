import { describe, expect, it } from 'vitest';
import { PASSWORD_MIN_LENGTH, validateSignIn, validateSignUp, type SignUpInput } from './credentials';

const good: SignUpInput = {
  phone: '0912345678',
  password: 'strong-pass',
  passwordConfirm: 'strong-pass',
  fullName: '  علي   محمد ',
  nationality: 'libyan',
  nationalId: '119850012345',
};

/** Same input with a new password typed identically in both fields. */
const withPassword = (password: string): SignUpInput => ({ ...good, password, passwordConfirm: password });

describe('validateSignUp', () => {
  it('normalizes phone, name and identity document', () => {
    expect(validateSignUp(good)).toEqual({
      ok: true,
      value: {
        phone: '+218912345678',
        password: 'strong-pass',
        fullName: 'علي محمد',
        identityDocument: { nationality: 'libyan', nationalId: '119850012345' },
      },
    });
  });

  it('requires the identity document (FR-ID-06)', () => {
    expect(validateSignUp({ ...good, nationality: undefined })).toEqual({
      ok: false,
      errors: [{ field: 'nationality', code: 'nationality_required' }],
    });
  });

  it('requires the full name (design S01.3)', () => {
    expect(validateSignUp({ ...good, fullName: '   ' })).toEqual({
      ok: false,
      errors: [{ field: 'fullName', code: 'full_name_required' }],
    });
  });

  it('requires the confirmation to match the password exactly', () => {
    expect(validateSignUp({ ...good, passwordConfirm: 'strong-pass ' })).toEqual({
      ok: false,
      errors: [{ field: 'passwordConfirm', code: 'password_mismatch' }],
    });
  });

  it('does not trim the password', () => {
    const r = validateSignUp(withPassword(' pass word '));
    expect(r.ok && r.value.password).toBe(' pass word ');
  });

  it('reports every invalid field at once', () => {
    const r = validateSignUp({ phone: '123', password: 'short', passwordConfirm: 'other', fullName: 'x'.repeat(101) });
    expect(r).toEqual({
      ok: false,
      errors: [
        { field: 'phone', code: 'phone_invalid' },
        { field: 'password', code: 'password_too_short' },
        { field: 'passwordConfirm', code: 'password_mismatch' },
        { field: 'fullName', code: 'full_name_too_long' },
        { field: 'nationality', code: 'nationality_required' },
      ],
    });
  });

  it('enforces the password bounds', () => {
    expect(validateSignUp(withPassword(''))).toMatchObject({ errors: [{ code: 'password_required' }] });
    expect(validateSignUp(withPassword('a'.repeat(PASSWORD_MIN_LENGTH))).ok).toBe(true);
    expect(validateSignUp(withPassword('a'.repeat(73)))).toMatchObject({ errors: [{ code: 'password_too_long' }] });
    // 8 Arabic letters = 8 characters (minimum met) but 16 bytes: length is counted in characters
    expect(validateSignUp(withPassword('كلمةسرّا')).ok).toBe(true);
  });
});

describe('validateSignIn', () => {
  it('accepts an old short password (server decides)', () => {
    expect(validateSignIn({ phone: '0921234567', password: 'abc' })).toEqual({
      ok: true,
      value: { phone: '+218921234567', password: 'abc' },
    });
  });

  it('requires both fields', () => {
    expect(validateSignIn({ phone: '', password: '' })).toEqual({
      ok: false,
      errors: [
        { field: 'phone', code: 'phone_required' },
        { field: 'password', code: 'password_required' },
      ],
    });
  });
});
