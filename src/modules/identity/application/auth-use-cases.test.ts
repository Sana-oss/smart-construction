import { describe, expect, it, vi } from 'vitest';
import type { AuthGateway } from './auth-gateway';
import { signIn, signOut, signUp, verifyPhone } from './auth-use-cases';

function fakeGateway(overrides: Partial<AuthGateway> = {}): AuthGateway {
  return {
    signUp: vi.fn(async () => ({ status: 'signed_in' as const })),
    signIn: vi.fn(async () => ({ status: 'signed_in' as const })),
    verifyPhone: vi.fn(async () => ({ status: 'signed_in' as const })),
    signOut: vi.fn(async () => {}),
    ...overrides,
  };
}

const foreigner = {
  nationality: 'foreign',
  passportNumber: 'ab 1234567',
  fullName: 'Ali',
  passwordConfirm: 'strong-pass',
};

describe('signUp', () => {
  it('sends normalized data to the provider', async () => {
    const gw = fakeGateway();
    const r = await signUp(gw, { phone: '091 234 5678', password: 'strong-pass', ...foreigner, fullName: ' Ali ' });
    expect(r).toEqual({ ok: true, next: 'signed_in', phone: '+218912345678' });
    expect(gw.signUp).toHaveBeenCalledWith({
      phone: '+218912345678',
      password: 'strong-pass',
      fullName: 'Ali',
      identityDocument: { nationality: 'foreign', passportNumber: 'AB1234567' },
    });
  });

  it('never calls the provider with invalid input', async () => {
    const gw = fakeGateway();
    const r = await signUp(gw, { phone: 'abc', password: '1', passwordConfirm: '1', fullName: '' });
    expect(r.ok).toBe(false);
    expect(r).toHaveProperty('fieldErrors');
    expect(gw.signUp).not.toHaveBeenCalled();
  });

  it('passes on the need for SMS verification', async () => {
    const gw = fakeGateway({ signUp: async () => ({ status: 'needs_verification' }) });
    expect(await signUp(gw, { phone: '0921234567', password: 'strong-pass', ...foreigner })).toEqual({
      ok: true,
      next: 'needs_verification',
      phone: '+218921234567',
    });
  });

  it('passes on provider failures as reasons', async () => {
    const gw = fakeGateway({ signUp: async () => ({ status: 'failed', reason: 'phone_taken' }) });
    expect(await signUp(gw, { phone: '0921234567', password: 'strong-pass', ...foreigner })).toEqual({
      ok: false,
      failure: 'phone_taken',
    });
  });
});

describe('signIn', () => {
  it('signs in with a normalized phone', async () => {
    const gw = fakeGateway();
    await signIn(gw, { phone: '+218 94 123 4567', password: 'x' });
    expect(gw.signIn).toHaveBeenCalledWith({ phone: '+218941234567', password: 'x' });
  });

  it('reports wrong credentials', async () => {
    const gw = fakeGateway({ signIn: async () => ({ status: 'failed', reason: 'invalid_credentials' }) });
    expect(await signIn(gw, { phone: '0941234567', password: 'x' })).toEqual({ ok: false, failure: 'invalid_credentials' });
  });
});

describe('verifyPhone', () => {
  it('validates the code before calling the provider', async () => {
    const gw = fakeGateway();
    const r = await verifyPhone(gw, { phone: '0951234567', code: '12' });
    expect(r).toEqual({ ok: false, fieldErrors: [{ field: 'code', code: 'otp_invalid' }] });
    expect(gw.verifyPhone).not.toHaveBeenCalled();
  });

  it('accepts Arabic-Indic digits in the code', async () => {
    const gw = fakeGateway();
    await verifyPhone(gw, { phone: '0951234567', code: '١٢٣ ٤٥٦' });
    expect(gw.verifyPhone).toHaveBeenCalledWith('+218951234567', '123456');
  });
});

describe('signOut', () => {
  it('delegates to the provider', async () => {
    const gw = fakeGateway();
    await signOut(gw);
    expect(gw.signOut).toHaveBeenCalledOnce();
  });
});
