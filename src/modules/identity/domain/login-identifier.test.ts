import { describe, expect, it } from 'vitest';
import { normalizeLibyanMobile } from './phone';
import { LOGIN_EMAIL_DOMAIN, loginEmailForPhone } from './login-identifier';

describe('loginEmailForPhone', () => {
  it('maps a normalized number to a fixed login name on a non-deliverable domain', () => {
    expect(loginEmailForPhone('+218912345678')).toBe('218912345678@phone.rakeeza.invalid');
    expect(LOGIN_EMAIL_DOMAIN.endsWith('.invalid')).toBe(true);
  });

  it('gives the same login name however the user typed the number', () => {
    const typed = ['0912345678', '+218 91 234 5678', '00218912345678', '٠٩١٢٣٤٥٦٧٨'];
    const names = typed.map((t) => {
      const p = normalizeLibyanMobile(t);
      if (!p.ok) throw new Error(`not valid: ${t}`);
      return loginEmailForPhone(p.value);
    });
    expect(new Set(names).size).toBe(1);
  });

  it('refuses anything that is not a normalized Libyan mobile number', () => {
    expect(() => loginEmailForPhone('0912345678')).toThrow();
    expect(() => loginEmailForPhone('+201012345678')).toThrow();
    expect(() => loginEmailForPhone('+218912345678@x')).toThrow();
  });
});
