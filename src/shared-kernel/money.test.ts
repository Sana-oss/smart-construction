import { describe, expect, it } from 'vitest';
import { addMoney, convertMoney, money, percentOf, subMoney, toDb } from './money';

describe('money', () => {
  it('has no floating point drift', () => {
    expect(toDb(addMoney('0.1', '0.2'))).toBe('0.300');
  });
  it('computes percentages', () => {
    expect(toDb(percentOf('100000', '10'))).toBe('10000.000');
  });
  it('rounds half up to 3 places', () => {
    expect(toDb(money('1.0005'))).toBe('1.001');
  });
  it('subtracts and converts with a reference rate', () => {
    expect(toDb(subMoney('1000', '250.5'))).toBe('749.500');
    expect(toDb(convertMoney('100', '4.85'))).toBe('485.000');
  });
});
