import { describe, expect, it } from 'vitest';
import { isReceiptPathOf, receiptStoragePath } from './receipt';

const P = '11111111-1111-4111-8111-111111111111';
const Q = '22222222-2222-4222-8222-222222222222';
const R = '33333333-3333-4333-8333-333333333333';

describe('receipt storage path', () => {
  it("puts a receipt under its project's folder", () => {
    expect(receiptStoragePath(P, R)).toBe(`${P}/receipts/${R}.jpg`);
  });

  it('accepts only a receipt path of the same project', () => {
    expect(isReceiptPathOf(P, `${P}/receipts/${R}.jpg`)).toBe(true);
    expect(isReceiptPathOf(P, `${Q}/receipts/${R}.jpg`)).toBe(false);
    expect(isReceiptPathOf(P, `${P}/photos/${R}.jpg`)).toBe(false);
    expect(isReceiptPathOf(P, `${P}/receipts/${R}.png`)).toBe(false);
    expect(isReceiptPathOf(P, `${P}/receipts/../${Q}/x.jpg`)).toBe(false);
  });

  it('refuses ids that are not uuids', () => {
    expect(() => receiptStoragePath(P, 'x')).toThrow();
  });
});
