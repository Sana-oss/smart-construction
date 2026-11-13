import { describe, expect, it } from 'vitest';
import { formatAmount } from './format';

describe('formatAmount', () => {
  it.each([
    ['450000', '450,000'],
    ['1250.500', '1,250.5'],
    ['0', '0'],
    ['-12500', '-12,500'],
    ['999.999', '999.999'],
  ])('%s -> %s', (input, expected) => {
    expect(formatAmount(input)).toBe(expected);
  });
});
