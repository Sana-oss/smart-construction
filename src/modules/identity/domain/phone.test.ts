import { describe, expect, it } from 'vitest';
import { normalizeLibyanMobile } from './phone';

describe('normalizeLibyanMobile', () => {
  it.each([
    ['0912345678', '+218912345678'],
    ['912345678', '+218912345678'],
    ['+218912345678', '+218912345678'],
    ['00218912345678', '+218912345678'],
    ['218912345678', '+218912345678'],
    ['091 234 5678', '+218912345678'],
    ['091-234-5678', '+218912345678'],
    ['(092) 234.5678', '+218922345678'],
    ['+218 95 123 4567', '+218951234567'],
    ['٠٩٤١٢٣٤٥٦٧', '+218941234567'], // Arabic-Indic digits
    ['۰۹۳۱۲۳۴۵۶۷', '+218931234567'], // Persian digits
  ])('accepts %s', (input, expected) => {
    expect(normalizeLibyanMobile(input)).toEqual({ ok: true, value: expected });
  });

  it.each(['', '   '])('requires a value (%j)', (input) => {
    expect(normalizeLibyanMobile(input)).toEqual({ ok: false, error: 'phone_required' });
  });

  it.each([
    ['unknown prefix', '0962345678'],
    ['landline (Tripoli 021)', '0213334444'],
    ['too short', '091234567'],
    ['too long', '09123456789'],
    ['letters', '09123abc78'],
    ['plus in the middle', '091+2345678'],
    ['other country code', '+201012345678'],
  ])('rejects %s', (_label, input) => {
    expect(normalizeLibyanMobile(input)).toEqual({ ok: false, error: 'phone_invalid' });
  });
});
