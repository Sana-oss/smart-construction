import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import { calculateRebar, concreteVolume, finishArea, tileCount, type RebarCoefficient } from './calculators';

// The coefficient below is test data, matching the teammate's design S22.2 (16 mm × 12 m = 18.96 kg per bar).
// The app reads the real one from the database with its review status.
const COEFF: RebarCoefficient = { divisor: new Decimal(162), status: 'unreviewed', source: 'S22.2', reviewedBy: null, reviewedOn: null };

describe('calculateRebar (FR-MAT-04, design S22)', () => {
  it('gives the design example: 16 mm, 12 m, 50 bars = 948 kg', () => {
    const r = calculateRebar({ diameterMm: '16', lengthM: '12', count: '50' }, COEFF);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.barKg.toFixed(2)).toBe('18.96');
    expect(r.value.totalLengthM.toString()).toBe('600');
    // Exactly 948.148… kg; shown to the nearest kg, as in the design.
    expect(r.value.totalKg.toString()).toBe('948');
    expect(r.value.totalWithWasteTons.toFixed(2)).toBe('0.95');
    expect(r.value.wastePct).toBeNull();
    expect(r.value.costLyd).toBeNull();
    expect(r.value.coefficient.status).toBe('unreviewed');
  });

  it('adds the waste the owner typed, then prices the tons', () => {
    const r = calculateRebar({ diameterMm: '١٦', lengthM: '12', count: '50', wastePct: '5', priceLydPerTon: '4,000' }, COEFF);
    // Exactly 948.148… × 1.05 = 995.555… kg; the cost uses the exact weight: 0.995555… t × 4,000 = 3,982.222.
    expect(r.ok && [r.value.totalWithWasteKg.toString(), r.value.totalWithWasteTons.toFixed(2), r.value.costLyd!.toFixed(3)]).toEqual(['996', '1.00', '3982.222']);
  });

  it('accepts 0 waste and a 0 price', () => {
    const r = calculateRebar({ diameterMm: '12', lengthM: '6', count: '10', wastePct: '0', priceLydPerTon: '0' }, COEFF);
    expect(r.ok && [r.value.wastePct!.toString(), r.value.costLyd!.toFixed(3)]).toEqual(['0', '0.000']);
  });

  it('reports every wrong field', () => {
    const r = calculateRebar({ diameterMm: '', lengthM: '-3', count: '2.5', wastePct: '101', priceLydPerTon: 'abc' }, COEFF);
    expect(r.ok === false && 'errors' in r ? r.errors : []).toEqual([
      { field: 'diameterMm', code: 'required' },
      { field: 'lengthM', code: 'invalid_number' },
      { field: 'count', code: 'must_be_whole' },
      { field: 'wastePct', code: 'too_large' },
      { field: 'priceLydPerTon', code: 'invalid_number' },
    ]);
  });

  it('refuses zero and absurd values', () => {
    const r = calculateRebar({ diameterMm: '0', lengthM: '1001', count: '1' }, COEFF);
    expect(r.ok === false && 'errors' in r ? r.errors : []).toEqual([
      { field: 'diameterMm', code: 'must_be_positive' },
      { field: 'lengthM', code: 'too_large' },
    ]);
  });

  it('gives no number without a coefficient', () => {
    expect(calculateRebar({ diameterMm: '16', lengthM: '12', count: '50' }, null)).toEqual({ ok: false, noCoefficient: true });
  });
});

describe('geometric calculators (FR-MAT-05, design S23)', () => {
  it('concrete volume: the design example 10 × 8 × 0.15 = 12 m³', () => {
    const r = concreteVolume({ lengthM: '10', widthM: '8', thicknessM: '0.15' });
    expect(r.ok && r.value.volumeM3.toString()).toBe('12');
  });

  it('finish area: length × width', () => {
    const r = finishArea({ lengthM: '4.5', widthM: '3' });
    expect(r.ok && r.value.areaM2.toString()).toBe('13.5');
  });

  it('tile count rounds up to whole tiles', () => {
    const r = tileCount({ areaM2: '13.5', tileLengthCm: '60', tileWidthCm: '60' });
    expect(r.ok && [r.value.tileAreaM2.toString(), r.value.count.toString()]).toEqual(['0.36', '38']);
    const exact = tileCount({ areaM2: '36', tileLengthCm: '60', tileWidthCm: '60' });
    expect(exact.ok && exact.value.count.toString()).toBe('100');
  });

  it('reports wrong inputs', () => {
    const r = concreteVolume({ lengthM: '10', widthM: '', thicknessM: '0' });
    expect(r.ok ? [] : r.errors).toEqual([
      { field: 'widthM', code: 'required' },
      { field: 'thicknessM', code: 'must_be_positive' },
    ]);
  });
});
