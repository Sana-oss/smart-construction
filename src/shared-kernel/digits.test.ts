import { describe, expect, it } from 'vitest';
import { parseDecimalInput, toAsciiDigits } from './digits';

describe('toAsciiDigits', () => {
  it('converts Arabic-Indic and Persian digits', () => {
    expect(toAsciiDigits('٠١٢٣٤٥٦٧٨٩ ۰۹')).toBe('0123456789 09');
  });
});

describe('parseDecimalInput', () => {
  it.each([
    ['450,000', '450000'],
    ['٤٥٠٬٠٠٠', '450000'],
    ['240.5', '240.5'],
    ['٢٤٠٫٥', '240.5'],
    [' 1 000 ', '1000'],
    ['007', '7'],
    ['0', '0'],
  ])('accepts %j', (input, expected) => {
    expect(parseDecimalInput(input)).toBe(expected);
  });

  it.each(['', '  ', '-5', '1e3', '12.', '.5', 'abc', '1,2,3x', null, undefined])('rejects %j', (input) => {
    expect(parseDecimalInput(input as string)).toBeNull();
  });
});

