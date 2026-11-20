import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import type { RebarCoefficient } from '../domain/calculators';
import { getRebarCalculator, isGeometricKind, runGeometricCalculator } from './calculators';

// Test data (the app reads the coefficient from the database, with its review status).
const COEFF: RebarCoefficient = { divisor: new Decimal(162), status: 'unreviewed', source: 'S22.2', reviewedBy: null, reviewedOn: null };
const reader = (c: RebarCoefficient | null) => ({ rebarCoefficient: async () => c });

describe('getRebarCalculator (design S22)', () => {
  it('shows the empty form before anything is submitted', async () => {
    expect(await getRebarCalculator(reader(COEFF), null)).toEqual({ coefficient: COEFF, calculation: null });
  });

  it('calculates with the stored coefficient', async () => {
    const v = await getRebarCalculator(reader(COEFF), { diameterMm: '16', lengthM: '12', count: '50' });
    expect(v.calculation?.ok && v.calculation.value.totalKg.toString()).toBe('948');
  });

  it('gives a notice, not a number, when the database has no coefficient', async () => {
    const v = await getRebarCalculator(reader(null), { diameterMm: '16', lengthM: '12', count: '50' });
    expect(v.calculation).toEqual({ ok: false, noCoefficient: true });
  });
});

describe('runGeometricCalculator (design S23)', () => {
  it('runs each calculator and returns display strings', () => {
    expect(runGeometricCalculator('concrete', { lengthM: '10', widthM: '8', thicknessM: '0.15' })).toEqual({ ok: true, kind: 'concrete', inputs: ['10', '8', '0.15'], value: { volumeM3: '12' } });
    expect(runGeometricCalculator('area', { lengthM: '٥', widthM: '4' })).toEqual({ ok: true, kind: 'area', inputs: ['5', '4'], value: { areaM2: '20' } });
    expect(runGeometricCalculator('tiles', { areaM2: '20', tileLengthCm: '60', tileWidthCm: '60' })).toEqual({
      ok: true,
      kind: 'tiles',
      inputs: ['20', '60', '60'],
      value: { tileAreaM2: '0.36', count: '56' },
    });
  });

  it('passes the errors on', () => {
    expect(runGeometricCalculator('area', { lengthM: '5' })).toEqual({ ok: false, kind: 'area', errors: [{ field: 'widthM', code: 'required' }] });
  });

  it('knows its kinds', () => {
    expect([isGeometricKind('tiles'), isGeometricKind('bricks')]).toEqual([true, false]);
  });
});
