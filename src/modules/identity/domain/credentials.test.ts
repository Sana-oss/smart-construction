import { describe, expect, it } from 'vitest';
import { PASSWORD_MIN_LENGTH, validateSignIn, validateSignUp } from './credentials';

const good = {
  phone: '0912345678',
  password: 'strong-pass',
  fullName: '  علي   محمد ',
  nationality: 'libyan',
  nationalId: '119850012345',
};

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

  it('treats a blank name as no name', () => {
    const r = validateSignUp({ ...good, fullName: '   ' });
    expect(r.ok && r.value.fullName).toBeNull();
  });

  it('does not trim the password', () => {
    const r = validateSignUp({ ...good, password: ' pass word ' });
    expect(r.ok && r.value.password).toBe(' pass word ');
  });

  it('reports every invalid field at once', () => {
    const r = validateSignUp({ phone: '123', password: 'short', fullName: 'x'.repeat(101) });
    expect(r).toEqual({
      ok: false,
      errors: [
        { field: 'phone', code: 'phone_invalid' },
        { field: 'password', code: 'password_too_short' },
        { field: 'fullName', code: 'full_name_too_long' },
        { field: 'nationality', code: 'nationality_required' },
      ],
    });
  });

  it('enforces the password bounds', () => {
    expect(validateSignUp({ ...good, password: '' })).toMatchObject({ errors: [{ code: 'password_required' }] });
    expect(validateSignUp({ ...good, password: 'a'.repeat(PASSWORD_MIN_LENGTH) }).ok).toBe(true);
    expect(validateSignUp({ ...good, password: 'a'.repeat(73) })).toMatchObject({ errors: [{ code: 'password_too_long' }] });
    // 8 Arabic letters = 8 characters (minimum met) but 16 bytes: length is counted in characters
    expect(validateSignUp({ ...good, password: 'كلمةسرّا' }).ok).toBe(true);
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
