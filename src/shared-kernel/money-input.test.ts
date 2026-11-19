import { describe, expect, it } from 'vitest';
import { readMoneyInput } from './money-input';

const value = (raw: string, allowZero = false) => {
  const r = readMoneyInput(raw, { allowZero });
  return r.ok ? r.value.toFixed(3) : r.code;
};

describe('readMoneyInput', () => {
  it('reads Latin and Arabic digits and separators', () => {
    expect(value('12,000')).toBe('12000.000');
    expect(value('١٢٬٥٠٠٫٥')).toBe('12500.500');
  });

  it('refuses what is not an amount, more than 3 decimals, or too large for numeric(14,3)', () => {
    expect(value('')).toBe('required');
    expect(value('abc')).toBe('invalid_number');
    expect(value('1.2345')).toBe('invalid_number');
    expect(value('123456789012')).toBe('too_large');
  });

  it('refuses zero and negatives for amounts paid or owed', () => {
    expect(value('0')).toBe('must_be_positive');
    expect(value('-5')).toBe('invalid_number');
  });

  it('allows zero but not a negative for prices', () => {
    expect(value('0', true)).toBe('0.000');
    expect(value('-5', true)).toBe('invalid_number');
  });
});
