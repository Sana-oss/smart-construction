import Decimal from 'decimal.js';
import { money, parseDecimalInput, type Money } from '@/shared-kernel';

// Quantity calculators (3.3; FR-MAT-04, FR-MAT-05; design S22.1 «حاسبة الحديد», S22.2 «نتيجة وزن الحديد», S23.1
// «الحاسبات الأخرى», S23.2 «حجم الخرسانة»). Deterministic formulas, no AI (master reference 3.3). Pure: no React, no
// database. The calculators save nothing (slice 1 of 3.3); the quantity table comes in slice 2.
//
// Engineering content: the only engineering number here is the rebar coefficient, and it is NOT in the code. It comes
// from the database (calc_coefficients, migration 0023) with its review status, and the screen shows that status.
// The geometric calculators (volume, area, tile count) use only geometry, so they need no coefficient.

const D = Decimal.clone({ precision: 30, rounding: Decimal.ROUND_HALF_UP });

/** Input sanity limits (not engineering values): they only stop typing mistakes such as an extra zero. */
export const LIMITS = {
  diameterMm: 100,
  lengthM: 1000,
  count: 100000,
  wastePct: 100,
  tileCm: 500,
  areaM2: 1000000,
} as const;

export type CalcErrorCode = 'required' | 'invalid_number' | 'must_be_positive' | 'too_large' | 'must_be_whole';
export interface CalcError<F extends string> {
  field: F;
  code: CalcErrorCode;
}
type Read = { ok: true; value: Decimal } | { ok: false; code: CalcErrorCode };

/** A typed positive number (Arabic or Latin digits). Optional fields may be empty: the result is then null. */
function readNumber(raw: string | null | undefined, max: number, { whole = false, allowZero = false } = {}): Read {
  if ((raw ?? '').trim() === '') return { ok: false, code: 'required' };
  const parsed = parseDecimalInput(raw);
  if (parsed === null) return { ok: false, code: 'invalid_number' };
  const value = new D(parsed);
  if (whole && !value.isInteger()) return { ok: false, code: 'must_be_whole' };
  if (allowZero ? value.isNegative() : value.lte(0)) return { ok: false, code: 'must_be_positive' };
  if (value.gt(max)) return { ok: false, code: 'too_large' };
  return { ok: true, value };
}

type Spec<F extends string> = Record<F, { max: number; whole?: boolean; optional?: boolean; allowZero?: boolean }>;

function readAll<F extends string>(input: Partial<Record<F, string | null>>, spec: Spec<F>) {
  const errors: CalcError<F>[] = [];
  const values = {} as Record<F, Decimal | null>;
  for (const field of Object.keys(spec) as F[]) {
    const { max, whole, optional, allowZero } = spec[field];
    const raw = input[field];
    if (optional && (raw ?? '').trim() === '') {
      values[field] = null;
      continue;
    }
    const r = readNumber(raw, max, { whole, allowZero });
    if (r.ok) values[field] = r.value;
    else errors.push({ field, code: r.code });
  }
  return { errors, values };
}

// ---------------------------------------------------------------------------------------------------------------
// Rebar (FR-MAT-04). The diameters, lengths and counts come from the engineer's bar schedule: the app never estimates
// rebar from an area or dimensions (master reference, 13 Oct 2026). Weight per metre = d² / divisor (kg/m, d in mm).

/** The coefficient as stored, with its review status (CLAUDE.md: engineering numbers are data until approved). */
export interface RebarCoefficient {
  divisor: Decimal;
  status: 'unreviewed' | 'approved';
  source: string;
  reviewedBy: string | null;
  reviewedOn: string | null;
}

export type RebarField = 'diameterMm' | 'lengthM' | 'count' | 'wastePct' | 'priceLydPerTon';
export type RebarInput = Partial<Record<RebarField, string | null>>;

export interface RebarResult {
  diameterMm: Decimal;
  lengthM: Decimal;
  count: Decimal;
  /** kg per metre and per bar, rounded to 3 and 2 places for display. */
  kgPerM: Decimal;
  barKg: Decimal;
  /** count × length, in metres. */
  totalLengthM: Decimal;
  /** Without waste, to the nearest kg (an approximate value, as the design says: «قيمة تقريبية»). */
  totalKg: Decimal;
  /** null when no waste was typed. */
  wastePct: Decimal | null;
  /** To the nearest kg. The tons and the cost are computed from the exact weight, not from this rounded one. */
  totalWithWasteKg: Decimal;
  totalWithWasteTons: Decimal;
  /** The price per ton the owner typed, and the cost; both null when no price was typed. */
  priceLydPerTon: Money | null;
  costLyd: Money | null;
  coefficient: RebarCoefficient;
}

export type RebarCalculation =
  | { ok: true; value: RebarResult }
  | { ok: false; errors: CalcError<RebarField>[] }
  | { ok: false; noCoefficient: true };

export function calculateRebar(input: RebarInput, coefficient: RebarCoefficient | null): RebarCalculation {
  const { errors, values } = readAll<RebarField>(input, {
    diameterMm: { max: LIMITS.diameterMm },
    lengthM: { max: LIMITS.lengthM },
    count: { max: LIMITS.count, whole: true },
    wastePct: { max: LIMITS.wastePct, optional: true, allowZero: true },
    priceLydPerTon: { max: 99_999_999_999, optional: true, allowZero: true },
  });
  if (errors.length > 0) return { ok: false, errors };
  // No coefficient in the database: a notice instead of a number (FR-MAT-04), never a guessed value.
  if (!coefficient || coefficient.divisor.lte(0)) return { ok: false, noCoefficient: true };

  const d = values.diameterMm!;
  const length = values.lengthM!;
  const count = values.count!;
  const exactKgPerM = d.pow(2).div(coefficient.divisor);
  const exactBarKg = exactKgPerM.times(length);
  const exactTotalKg = exactBarKg.times(count);
  const exactWithWaste = values.wastePct ? exactTotalKg.times(new D(100).plus(values.wastePct)).div(100) : exactTotalKg;
  const tons = exactWithWaste.div(1000);

  return {
    ok: true,
    value: {
      diameterMm: d,
      lengthM: length,
      count,
      kgPerM: exactKgPerM.toDecimalPlaces(3),
      barKg: exactBarKg.toDecimalPlaces(2),
      totalLengthM: length.times(count).toDecimalPlaces(3),
      totalKg: exactTotalKg.toDecimalPlaces(0),
      wastePct: values.wastePct,
      totalWithWasteKg: exactWithWaste.toDecimalPlaces(0),
      totalWithWasteTons: tons.toDecimalPlaces(2),
      priceLydPerTon: values.priceLydPerTon === null ? null : money(values.priceLydPerTon),
      costLyd: values.priceLydPerTon === null ? null : money(tons.times(values.priceLydPerTon)),
      coefficient,
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Geometric calculators (FR-MAT-05, design S23). Geometry only, «دون إضافات»: no waste, no mix ratios.

export type CalcResult<F extends string, R> = { ok: true; value: R } | { ok: false; errors: CalcError<F>[] };

export type VolumeField = 'lengthM' | 'widthM' | 'thicknessM';
/** S23.2 «حجم الخرسانة»: length × width × thickness, in m³ (3 places). */
export function concreteVolume(input: Partial<Record<VolumeField, string | null>>): CalcResult<VolumeField, { volumeM3: Decimal }> {
  const { errors, values } = readAll<VolumeField>(input, {
    lengthM: { max: LIMITS.lengthM },
    widthM: { max: LIMITS.lengthM },
    thicknessM: { max: LIMITS.lengthM },
  });
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { volumeM3: values.lengthM!.times(values.widthM!).times(values.thicknessM!).toDecimalPlaces(3) } };
}

export type AreaField = 'lengthM' | 'widthM';
/** S23.1 «مساحة التشطيب»: length × width, in m² (3 places). */
export function finishArea(input: Partial<Record<AreaField, string | null>>): CalcResult<AreaField, { areaM2: Decimal }> {
  const { errors, values } = readAll<AreaField>(input, { lengthM: { max: LIMITS.lengthM }, widthM: { max: LIMITS.lengthM } });
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { areaM2: values.lengthM!.times(values.widthM!).toDecimalPlaces(3) } };
}

export type TileField = 'areaM2' | 'tileLengthCm' | 'tileWidthCm';
/**
 * S23.1 «عدد البلاط»: area ÷ tile area, rounded UP to whole tiles (half a tile is still a tile to buy). No waste or
 * cutting allowance: that is an engineering value the app does not invent.
 */
export function tileCount(input: Partial<Record<TileField, string | null>>): CalcResult<TileField, { tileAreaM2: Decimal; count: Decimal }> {
  const { errors, values } = readAll<TileField>(input, {
    areaM2: { max: LIMITS.areaM2 },
    tileLengthCm: { max: LIMITS.tileCm },
    tileWidthCm: { max: LIMITS.tileCm },
  });
  if (errors.length > 0) return { ok: false, errors };
  const tileArea = values.tileLengthCm!.times(values.tileWidthCm!).div(10000);
  return {
    ok: true,
    value: { tileAreaM2: tileArea.toDecimalPlaces(4), count: values.areaM2!.div(tileArea).toDecimalPlaces(0, Decimal.ROUND_CEIL) },
  };
}
