import { describe, expect, it } from 'vitest';
import { money } from '@/shared-kernel';
import { budgetPlan, sumByPhase, validateAllocations } from './allocation';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

describe('validateAllocations (S15.2)', () => {
  it('reads one amount per phase; empty means no allocation; 0 is allowed', () => {
    const r = validateAllocations({ [A]: '60,000', [B.toUpperCase()]: '', [C]: '0' }, [A, B, C]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.get(A)?.toFixed(3)).toBe('60000.000');
    expect(r.value.get(B)).toBeNull();
    expect(r.value.get(C)?.toFixed(3)).toBe('0.000');
  });

  it('refuses a phase of another project and a wrong amount', () => {
    const r = validateAllocations({ [A]: '-1', [C]: '5' }, [A]);
    expect(r.ok ? [] : r.errors).toEqual([
      { phaseId: A, code: 'invalid_number' },
      { phaseId: C, code: 'unknown_choice' },
    ]);
  });
});

describe('budgetPlan (S15.2, FR-FIN-11 with D5 = 10%)', () => {
  const phases = [{ id: A }, { id: B }, { id: C }];
  const plan = (allocA: string | null, spentA: string, more: Partial<{ allocB: string | null; spentNone: string; total: string }> = {}) =>
    budgetPlan({
      phases,
      allocations: new Map([
        [A, allocA === null ? null : money(allocA)],
        [B, more.allocB ? money(more.allocB) : null],
      ]),
      spentByPhase: new Map<string | null, string>([
        [A, spentA],
        [null, more.spentNone ?? '0'],
      ]),
      total: more.total ?? '450000',
      contingency: '20000',
    });

  it('warns only above allocation × 1.10, not at it', () => {
    expect(plan('60000', '66000').rows[0]).toMatchObject({ usedPct: 110, over: false });
    expect(plan('60000', '66000.001').rows[0]).toMatchObject({ usedPct: 110, over: true });
    expect(plan('60000', '53000').rows[0]).toMatchObject({ usedPct: 88, over: false });
  });

  it('checks nothing without an allocation, or with a zero one', () => {
    expect(plan(null, '5000').rows[0]).toMatchObject({ allocated: null, usedPct: null, over: false });
    expect(plan('0', '5000').rows[0]).toMatchObject({ usedPct: null, over: false });
  });

  it('totals the allocations and warns when they exceed the budget less the contingency', () => {
    const p = plan('300000', '0', { allocB: '140000', spentNone: '750' });
    expect(p.allocatedTotal.toFixed(3)).toBe('440000.000');
    expect(p.forPhases.toFixed(3)).toBe('430000.000');
    expect(p.overAllocated).toBe(true);
    expect(p.unassigned.toFixed(3)).toBe('750.000');
    expect(plan('100000', '0').overAllocated).toBe(false);
  });

  it('counts the phases over their allocation', () => {
    expect(plan('1000', '2000').overPhases).toBe(1);
    expect(plan('1000', '100').overPhases).toBe(0);
  });
});

describe('sumByPhase', () => {
  it('adds the expenses of each phase, and those without a phase apart', () => {
    const m = sumByPhase([
      { phaseId: A, amountLyd: '100.5' },
      { phaseId: A, amountLyd: '0.25' },
      { phaseId: null, amountLyd: '7' },
    ]);
    expect([m.get(A)?.toFixed(3), m.get(null)?.toFixed(3), m.get(B)]).toEqual(['100.750', '7.000', undefined]);
  });
});
