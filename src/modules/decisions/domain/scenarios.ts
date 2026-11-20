import { addMoney, money, readMoneyInput, subMoney, toAsciiDigits, type Money, type MoneyInputError } from '@/shared-kernel';

// Continue, pause, or finish a phase then pause (3.7; FR-DEC-01, FR-DEC-02, FR-DEC-05; design S18.1; slice 3 of 3.7).
// Pure: no React, no database. Money is Decimal.
//
// The model (owner's decision of 20 Nov 2026, change register): each scenario has a cost NOW and a cost LATER.
//   - NOW is paid today; the application runs it through finance's 30-day cash outlook (the timing rule: income that
//     arrives after a payment does not cover it). This file stays pure and only splits the costs.
//   - LATER is what is still needed to finish the project; the owner's price change (FR-DEC-02) applies only to it.
//   - Materials already on site were paid for: they are subtracted ONCE, before anything else (no double counting).
//   continue           NOW = the remaining works                LATER = 0
//   pause now          NOW = protection + storage + restart     LATER = the remaining works, at changed prices
//   finish a phase     NOW = that phase + the pause costs        LATER = the rest, at changed prices
// The result is an estimate from the owner's own figures, never an automatic decision or a price forecast (FR-DEC-05).

export const SCENARIOS = ['continue', 'pause', 'finish_phase'] as const;
export type Scenario = (typeof SCENARIOS)[number];

/** FR-DEC-02's range (owner's decision of 20 Nov 2026). */
export const PRICE_CHANGE_MIN = -50;
export const PRICE_CHANGE_MAX = 100;

export type ComparisonField =
  | 'remainingWorks'
  | 'materialsOnHand'
  | 'phaseId'
  | 'phaseCost'
  | 'protection'
  | 'storage'
  | 'restart'
  | 'priceChangePct';
export type ComparisonErrorCode = MoneyInputError | 'invalid_percent' | 'percent_out_of_range' | 'unknown_choice' | 'phase_more_than_remaining' | 'phase_cost_without_phase';
export interface ComparisonError {
  field: ComparisonField;
  code: ComparisonErrorCode;
}

/** What the inputs form sends, as typed. Every field is optional: what is missing is shown as «ناقص» (FR-DEC-03). */
export interface ComparisonInput {
  /** Everything still needed to finish the project (materials, labour, other), in LYD. */
  remainingWorks?: string | null;
  /** Value of materials already on site (paid). */
  materialsOnHand?: string | null;
  /** The phase finished before pausing (scenario 3), one of `phaseIds`. */
  phaseId?: string | null;
  /** What is still needed to finish that phase. */
  phaseCost?: string | null;
  protection?: string | null;
  storage?: string | null;
  restart?: string | null;
  /** "+10", "-5", "0": the change for what is bought later. Empty = 0. */
  priceChangePct?: string | null;
}

export interface ComparisonInputs {
  remainingWorks: Money | null;
  materialsOnHand: Money | null;
  phaseId: string | null;
  phaseCost: Money | null;
  protection: Money | null;
  storage: Money | null;
  restart: Money | null;
  /** Percent, as a decimal string with up to 2 places ("12.5"). */
  priceChangePct: string;
}

export type ComparisonValidation = { ok: true; value: ComparisonInputs } | { ok: false; errors: ComparisonError[] };

/** "+12,5" / "−5" / "١٠" -> "12.5" / "-5" / "10", or null when it is not a percentage with up to 2 decimals. */
export function readPercent(raw: string | null | undefined): string | null {
  const s = toAsciiDigits((raw ?? '').trim()).replace(/[٫,]/g, '.').replace(/[−–]/g, '-').replace(/\s|%|٪/g, '');
  if (s === '') return '0';
  const m = /^([+-]?)(\d{1,3})(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const value = money(`${m[1] === '-' ? '-' : ''}${m[2]}.${m[3] ?? '0'}`);
  return value.isZero() ? '0' : value.toString();
}

/** @param phaseIds the project's phases (only one of them may be chosen). */
export function validateComparison(input: ComparisonInput, phaseIds: readonly string[]): ComparisonValidation {
  const errors: ComparisonError[] = [];
  const amount = (field: ComparisonField, raw: string | null | undefined, allowZero: boolean): Money | null => {
    if ((raw ?? '').trim() === '') return null; // missing: allowed, shown as «ناقص»
    const r = readMoneyInput(raw, { allowZero });
    if (r.ok) return r.value;
    errors.push({ field, code: r.code });
    return null;
  };

  const remainingWorks = amount('remainingWorks', input.remainingWorks, false);
  const materialsOnHand = amount('materialsOnHand', input.materialsOnHand, true);

  let phaseId: string | null = null;
  const phase = (input.phaseId ?? '').trim().toLowerCase();
  if (phase !== '') {
    if (phaseIds.includes(phase)) phaseId = phase;
    else errors.push({ field: 'phaseId', code: 'unknown_choice' });
  }
  const phaseCost = amount('phaseCost', input.phaseCost, true);
  if (phaseCost !== null && phase === '') errors.push({ field: 'phaseCost', code: 'phase_cost_without_phase' });
  if (phaseCost !== null && remainingWorks !== null && phaseCost.gt(remainingWorks)) {
    errors.push({ field: 'phaseCost', code: 'phase_more_than_remaining' });
  }

  const protection = amount('protection', input.protection, true);
  const storage = amount('storage', input.storage, true);
  const restart = amount('restart', input.restart, true);

  const pct = readPercent(input.priceChangePct);
  if (pct === null) errors.push({ field: 'priceChangePct', code: 'invalid_percent' });
  else if (money(pct).lt(PRICE_CHANGE_MIN) || money(pct).gt(PRICE_CHANGE_MAX)) errors.push({ field: 'priceChangePct', code: 'percent_out_of_range' });

  if (errors.length > 0 || pct === null) return { ok: false, errors };
  return { ok: true, value: { remainingWorks, materialsOnHand, phaseId, phaseCost, protection, storage, restart, priceChangePct: pct } };
}

/** What a scenario still needs before it can be trusted (FR-DEC-03). Never silently replaced by a guess. */
export type MissingInput = 'remainingWorks' | 'phase' | 'protection' | 'storage' | 'restart';

export interface ScenarioCost {
  scenario: Scenario;
  /** Null when the scenario lacks what it needs (remaining works; the phase for scenario 3). */
  costNow: Money | null;
  costLater: Money | null;
  /** costNow + costLater: what this way costs to finish the project. */
  total: Money | null;
  missing: MissingInput[];
}

const zero = money('0');
const max0 = (m: Money) => (m.lt(0) ? zero : m);
const min = (a: Money, b: Money) => (a.lt(b) ? a : b);
/** amount × (1 + pct/100), at 3 places. */
const changed = (amount: Money, pct: string) => money(amount.times(money(pct).plus(100)).dividedBy(100));

/**
 * The three scenarios' costs, now and later. A pause cost that is missing counts as 0 AND is listed as missing, so
 * the screen says the figure is incomplete rather than hiding the scenario.
 */
export function scenarioCosts(inputs: ComparisonInputs): ScenarioCost[] {
  const onHand = inputs.materialsOnHand ?? zero;
  const toBuy = inputs.remainingWorks === null ? null : max0(subMoney(inputs.remainingWorks, onHand));
  const noWorks: MissingInput[] = toBuy === null ? ['remainingWorks'] : [];

  const pauseMissing: MissingInput[] = [];
  if (inputs.protection === null) pauseMissing.push('protection');
  if (inputs.storage === null) pauseMissing.push('storage');
  if (inputs.restart === null) pauseMissing.push('restart');
  const pauseCost = addMoney('0', inputs.protection ?? '0', inputs.storage ?? '0', inputs.restart ?? '0');

  const cost = (scenario: Scenario, split: { now: Money; later: Money } | null, missing: MissingInput[]): ScenarioCost =>
    split
      ? { scenario, costNow: split.now, costLater: split.later, total: addMoney(split.now, split.later), missing }
      : { scenario, costNow: null, costLater: null, total: null, missing };

  // Scenario 3: the materials on site go to the chosen phase first.
  const hasPhase = inputs.phaseId !== null && inputs.phaseCost !== null;
  const phaseNow = toBuy !== null && hasPhase ? min(toBuy, max0(subMoney(inputs.phaseCost!, onHand))) : null;

  return [
    cost('continue', toBuy === null ? null : { now: toBuy, later: zero }, noWorks),
    cost('pause', toBuy === null ? null : { now: pauseCost, later: changed(toBuy, inputs.priceChangePct) }, [...noWorks, ...pauseMissing]),
    cost(
      'finish_phase',
      toBuy === null || phaseNow === null ? null : { now: addMoney(phaseNow, pauseCost), later: changed(subMoney(toBuy, phaseNow), inputs.priceChangePct) },
      [...noWorks, ...(hasPhase ? [] : (['phase'] as MissingInput[])), ...pauseMissing],
    ),
  ];
}
