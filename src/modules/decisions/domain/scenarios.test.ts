import { describe, expect, it } from 'vitest';
import { money } from '@/shared-kernel';
import { readPercent, scenarioCosts, validateComparison, type ComparisonInputs } from './scenarios';

const PHASE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const fixed = (m: { toFixed: (n: number) => string } | null) => (m === null ? null : m.toFixed(3));

describe('readPercent (FR-DEC-02)', () => {
  it('reads signs, Arabic digits and decimals; empty is 0', () => {
    expect(readPercent('+10')).toBe('10');
    expect(readPercent('−5')).toBe('-5');
    expect(readPercent('١٢٫٥ %')).toBe('12.5');
    expect(readPercent('')).toBe('0');
    expect(readPercent('-0')).toBe('0');
  });
  it('refuses what is not a percentage with up to 2 decimals', () => {
    expect(readPercent('abc')).toBeNull();
    expect(readPercent('1.234')).toBeNull();
    expect(readPercent('10-')).toBeNull();
  });
});

describe('validateComparison', () => {
  it('accepts the figures; every one may be missing', () => {
    const r = validateComparison({ remainingWorks: '200,000', materialsOnHand: '0', phaseId: PHASE.toUpperCase(), phaseCost: '50000', priceChangePct: '+10' }, [PHASE]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(fixed(r.value.remainingWorks)).toBe('200000.000');
    expect(r.value).toMatchObject({ phaseId: PHASE, protection: null, storage: null, restart: null, priceChangePct: '10' });
    expect(validateComparison({}, []).ok).toBe(true);
  });

  it('refuses a phase of another project, a phase cost without a phase or above the remaining works, and a % out of range', () => {
    const r = validateComparison(
      { remainingWorks: '1000', phaseId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', phaseCost: '2000', protection: '-1', priceChangePct: '150' },
      [PHASE],
    );
    expect(r.ok ? [] : r.errors).toEqual([
      { field: 'phaseId', code: 'unknown_choice' },
      { field: 'phaseCost', code: 'phase_more_than_remaining' },
      { field: 'protection', code: 'invalid_number' },
      { field: 'priceChangePct', code: 'percent_out_of_range' },
    ]);
    expect(validateComparison({ phaseCost: '10' }, [PHASE]).ok ? [] : (validateComparison({ phaseCost: '10' }, [PHASE]) as { errors: unknown[] }).errors).toEqual([
      { field: 'phaseCost', code: 'phase_cost_without_phase' },
    ]);
    expect(validateComparison({ priceChangePct: '-50' }, []).ok).toBe(true);
    expect(validateComparison({ priceChangePct: '-50.01' }, []).ok).toBe(false);
    expect(validateComparison({ priceChangePct: '100' }, []).ok).toBe(true);
  });
});

const inputs = (p: Partial<ComparisonInputs>): ComparisonInputs => ({
  remainingWorks: null,
  materialsOnHand: null,
  phaseId: null,
  phaseCost: null,
  protection: null,
  storage: null,
  restart: null,
  priceChangePct: '0',
  ...p,
});
const m = (s: string) => money(s);

describe('scenarioCosts (FR-DEC-01): now and later', () => {
  const full = inputs({
    remainingWorks: m('200000'),
    materialsOnHand: m('20000'),
    phaseId: PHASE,
    phaseCost: m('50000'),
    protection: m('3000'),
    storage: m('1500'),
    restart: m('5000'),
    priceChangePct: '10',
  });

  it('continue: everything still to buy, now', () => {
    const c = scenarioCosts(full)[0];
    expect([c.scenario, fixed(c.costNow), fixed(c.costLater), fixed(c.total), c.missing]).toEqual(['continue', '180000.000', '0.000', '180000.000', []]);
  });

  it('pause: the pause costs now, the works later at changed prices', () => {
    const c = scenarioCosts(full)[1];
    expect([fixed(c.costNow), fixed(c.costLater), fixed(c.total)]).toEqual(['9500.000', '198000.000', '207500.000']);
  });

  it('finish a phase then pause: the materials on site go to that phase first, then the pause costs', () => {
    const c = scenarioCosts(full)[2];
    // phase now = 50,000 − 20,000 on site = 30,000; + 9,500 pause = 39,500; later = (180,000 − 30,000) × 1.10 = 165,000
    expect([fixed(c.costNow), fixed(c.costLater), fixed(c.total)]).toEqual(['39500.000', '165000.000', '204500.000']);
  });

  it('counts the materials on site only once, even when they cover more than the phase or the works', () => {
    const c = scenarioCosts(inputs({ remainingWorks: m('10000'), materialsOnHand: m('15000'), phaseId: PHASE, phaseCost: m('5000') }));
    expect(c.map((s) => fixed(s.costNow))).toEqual(['0.000', '0.000', '0.000']);
    expect(c.map((s) => fixed(s.costLater))).toEqual(['0.000', '0.000', '0.000']);
  });

  it('a price fall makes waiting cheaper, and 0% leaves the price as it is', () => {
    const fall = scenarioCosts(inputs({ remainingWorks: m('100000'), priceChangePct: '-5' }))[1];
    expect(fixed(fall.costLater)).toBe('95000.000');
    const flat = scenarioCosts(inputs({ remainingWorks: m('100000') }))[1];
    expect(fixed(flat.costLater)).toBe('100000.000');
  });

  it('shows what is missing instead of guessing (FR-DEC-03)', () => {
    const none = scenarioCosts(inputs({}));
    expect(none.map((s) => [s.scenario, s.costNow, s.missing])).toEqual([
      ['continue', null, ['remainingWorks']],
      ['pause', null, ['remainingWorks', 'protection', 'storage', 'restart']],
      ['finish_phase', null, ['remainingWorks', 'phase', 'protection', 'storage', 'restart']],
    ]);
    // A missing pause cost counts as 0, but stays listed as missing.
    const partial = scenarioCosts(inputs({ remainingWorks: m('1000'), protection: m('100') }))[1];
    expect([fixed(partial.costNow), partial.missing]).toEqual(['100.000', ['storage', 'restart']]);
  });
});
