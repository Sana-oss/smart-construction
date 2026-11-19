import { describe, expect, it } from 'vitest';
import { latestPrices, materialKey, priceHistory, quoteStatus, validatePrice, type PriceRecord } from './price';

const TODAY = '2026-11-19';

describe('validatePrice (design S24.3, FR-MAT-08)', () => {
  const paid = { material: ' حديد  التسليح ', unit: 'طن', price: '٤٬٠٠٠', kind: 'paid', supplier: 'مورد الحديد', recordedOn: '2026-11-09' };

  it('accepts a paid price and cleans the text', () => {
    const r = validatePrice(paid, TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.priceLyd.toFixed(3)).toBe('4000.000');
    expect(r.value).toMatchObject({ material: 'حديد التسليح', unit: 'طن', kind: 'paid', supplier: 'مورد الحديد', recordedOn: '2026-11-09' });
    expect(r.value.expiresOn).toBeNull();
    expect(r.value.transportLyd).toBeNull();
  });

  it('accepts a quote with its validity and transport cost; a price may be 0', () => {
    const r = validatePrice({ ...paid, kind: 'quote', price: '0', expiresOn: '2026-11-30', transport: '150' }, TODAY);
    expect(r.ok && [r.value.priceLyd.toFixed(3), r.value.expiresOn, r.value.transportLyd?.toFixed(3)]).toEqual(['0.000', '2026-11-30', '150.000']);
  });

  it('leaves an empty date to the database (today in Libya)', () => {
    const r = validatePrice({ ...paid, recordedOn: '' }, TODAY);
    expect(r.ok && r.value.recordedOn).toBeNull();
  });

  it('reports every wrong field', () => {
    const r = validatePrice(
      { material: 'x', unit: '', price: '-1', kind: 'gift', recordedOn: '2026-11-20', expiresOn: '2026-11-25', transport: 'abc', note: 'ن'.repeat(201) },
      TODAY,
    );
    expect(r.ok ? [] : r.errors).toEqual([
      { field: 'material', code: 'too_short' },
      { field: 'unit', code: 'required' },
      { field: 'price', code: 'invalid_number' },
      { field: 'kind', code: 'unknown_choice' },
      { field: 'recordedOn', code: 'date_in_future' },
      { field: 'expiresOn', code: 'expiry_only_for_quote' },
      { field: 'transport', code: 'invalid_number' },
      { field: 'note', code: 'too_long' },
    ]);
  });

  it('refuses a quote that expires before the day it was given', () => {
    const r = validatePrice({ ...paid, kind: 'quote', expiresOn: '2026-11-01' }, TODAY);
    expect(r.ok ? [] : r.errors).toEqual([{ field: 'expiresOn', code: 'expiry_before_date' }]);
  });
});

describe('quoteStatus (FR-MAT-10, FR-DEC-03)', () => {
  it('paid prices never expire; quotes are open, expiring within 7 days, or expired', () => {
    expect(quoteStatus({ kind: 'paid', expiresOn: null }, TODAY)).toEqual({ kind: 'paid' });
    expect(quoteStatus({ kind: 'quote', expiresOn: null }, TODAY)).toEqual({ kind: 'open' });
    expect(quoteStatus({ kind: 'quote', expiresOn: '2026-11-27' }, TODAY)).toEqual({ kind: 'open' });
    expect(quoteStatus({ kind: 'quote', expiresOn: '2026-11-26' }, TODAY)).toEqual({ kind: 'expiring', daysLeft: 7 });
    expect(quoteStatus({ kind: 'quote', expiresOn: TODAY }, TODAY)).toEqual({ kind: 'expiring', daysLeft: 0 });
    expect(quoteStatus({ kind: 'quote', expiresOn: '2026-11-18' }, TODAY)).toEqual({ kind: 'expired' });
  });
});

const rec = (id: string, material: string, unit: string, priceLyd: string, recordedOn: string, createdAt = `${recordedOn}T10:00:00Z`): PriceRecord => ({
  id,
  material,
  unit,
  priceLyd,
  kind: 'paid',
  supplier: null,
  recordedOn,
  expiresOn: null,
  transportLyd: null,
  note: null,
  createdAt,
});

describe('latestPrices and priceHistory (S24.1, S24.2)', () => {
  const records = [
    rec('1', 'حديد التسليح', 'طن', '3850', '2026-10-20'),
    rec('2', 'أسمنت', 'كيس', '42', '2026-11-07'),
    rec('3', 'حديد  التسليح', 'طن', '4000', '2026-11-09'),
    rec('4', 'حديد التسليح', 'طن', '3900', '2026-11-09', '2026-11-09T08:00:00Z'), // same day, recorded earlier
    rec('5', 'حديد التسليح', 'كغ', '4.2', '2026-11-01'), // another unit: another row
  ];

  it('groups by material and unit, ignoring spacing and letter case', () => {
    expect(materialKey(' Steel  Bar ', 'TON')).toBe(materialKey('steel bar', 'ton'));
    expect(materialKey('حديد', 'طن')).not.toBe(materialKey('حديد', 'كغ'));
  });

  it('shows one row per material with its latest price, most recently updated first', () => {
    expect(latestPrices(records).map((g) => [g.material, g.unit, g.latest.priceLyd, g.count])).toEqual([
      ['حديد  التسليح', 'طن', '4000', 3],
      ['أسمنت', 'كيس', '42', 1],
      ['حديد التسليح', 'كغ', '4.2', 1],
    ]);
  });

  it('lists the history of one material, newest first', () => {
    expect(priceHistory(records, 'حديد التسليح', 'طن').map((r) => r.id)).toEqual(['3', '4', '1']);
  });
});
