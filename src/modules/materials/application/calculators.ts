import { parseDecimalInput } from '@/shared-kernel';
import {
  calculateRebar,
  type CalcErrorCode,
  concreteVolume,
  finishArea,
  tileCount,
  type RebarCalculation,
  type RebarCoefficient,
  type RebarInput,
} from '../domain/calculators';

// Quantity calculators (3.3, slice 1): read the coefficient, run the pure formulas. Nothing is saved.

/** Where the rebar coefficient comes from (the database in the app, a fake in tests). */
export interface CoefficientReader {
  rebarCoefficient(): Promise<RebarCoefficient | null>;
}

export interface RebarCalculatorView {
  /** null = no row in the database: the screen shows a notice instead of a number. */
  coefficient: RebarCoefficient | null;
  /** null = nothing submitted yet (the empty form, design S22.1). */
  calculation: RebarCalculation | null;
}

/** Design S22.1 / S22.2. `input` is null until the owner presses «احسب الوزن التقريبي». */
export async function getRebarCalculator(reader: CoefficientReader, input: RebarInput | null): Promise<RebarCalculatorView> {
  const coefficient = await reader.rebarCoefficient();
  return { coefficient, calculation: input ? calculateRebar(input, coefficient) : null };
}

/** The geometric calculators of design S23.1, in the design's order. */
export const GEOMETRIC_KINDS = ['concrete', 'area', 'tiles'] as const;
export type GeometricKind = (typeof GEOMETRIC_KINDS)[number];
export const isGeometricKind = (s: string): s is GeometricKind => (GEOMETRIC_KINDS as readonly string[]).includes(s);

/** The fields of each calculator, in the order the form shows them. */
export const GEOMETRIC_FIELDS = {
  concrete: ['lengthM', 'widthM', 'thicknessM'],
  area: ['lengthM', 'widthM'],
  tiles: ['areaM2', 'tileLengthCm', 'tileWidthCm'],
} as const satisfies Record<GeometricKind, readonly string[]>;

export type GeometricField = (typeof GEOMETRIC_FIELDS)[GeometricKind][number];
export type GeometricCalculation =
  | {
      ok: true;
      kind: GeometricKind;
      /** The inputs as numbers ("١٠" -> "10"), in the form's order, to show the calculation. */
      inputs: string[];
      value: { volumeM3?: string; areaM2?: string; tileAreaM2?: string; count?: string };
    }
  | { ok: false; kind: GeometricKind; errors: { field: GeometricField; code: CalcErrorCode }[] };

/** Design S23.2 and its two siblings. Results are returned as strings, ready to display (rule R5). */
export function runGeometricCalculator(kind: GeometricKind, input: Partial<Record<GeometricField, string | null>>): GeometricCalculation {
  const inputs = () => GEOMETRIC_FIELDS[kind].map((f) => parseDecimalInput(input[f]) ?? '');
  if (kind === 'concrete') {
    const r = concreteVolume(input);
    return r.ok ? { ok: true, kind, inputs: inputs(), value: { volumeM3: r.value.volumeM3.toString() } } : { ok: false, kind, errors: r.errors };
  }
  if (kind === 'area') {
    const r = finishArea(input);
    return r.ok ? { ok: true, kind, inputs: inputs(), value: { areaM2: r.value.areaM2.toString() } } : { ok: false, kind, errors: r.errors };
  }
  const r = tileCount(input);
  return r.ok
    ? { ok: true, kind, inputs: inputs(), value: { tileAreaM2: r.value.tileAreaM2.toString(), count: r.value.count.toString() } }
    : { ok: false, kind, errors: r.errors };
}
