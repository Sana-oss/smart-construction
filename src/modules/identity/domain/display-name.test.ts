import { describe, expect, it } from 'vitest';
import { firstName } from './display-name';

describe('firstName', () => {
  it('takes the first word of the full name', () => {
    expect(firstName('  محمد   علي الورفلي ')).toBe('محمد');
    expect(firstName('سند')).toBe('سند');
  });

  it('is null without a name', () => {
    expect(firstName('')).toBeNull();
    expect(firstName('   ')).toBeNull();
    expect(firstName(null)).toBeNull();
  });
});
