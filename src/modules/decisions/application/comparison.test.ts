import { describe, expect, it, vi } from 'vitest';
import { money } from '@/shared-kernel';
import { buildComparison, saveComparisonInputs, saveReview, type ComparisonStore, type StoredComparison } from './comparison';

const PROJECT = '11111111-1111-4111-8111-111111111111';
const PHASE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TODAY = '2026-11-20';
const noWarnings = { stale: [], expired: [] };

function fakeStore() {
  const store: ComparisonStore = {
    load: vi.fn(async () => null),
    saveInputs: vi.fn(async () => ({ status: 'done' as const })),
    saveReview: vi.fn(async () => ({ status: 'done' as const })),
  };
  return store;
}

const review = { note: null, choice: null, steps: { fundingConfirmed: false, contractsReviewed: false, siteAssessed: false, planDecided: false } };
const stored = (inputs: Partial<StoredComparison['inputs']>): StoredComparison => ({
  inputs: {
    remainingWorks: null,
    materialsOnHand: null,
    phaseId: null,
    phaseCost: null,
    protection: null,
    storage: null,
    restart: null,
    priceChangePct: '0',
    ...inputs,
  },
  review,
});

describe('saveComparisonInputs', () => {
  it('stores the validated figures as decimal strings', async () => {
    const store = fakeStore();
    const r = await saveComparisonInputs(store, { projectId: PROJECT, remainingWorks: '200,000', phaseId: PHASE, phaseCost: '50000', priceChangePct: '+10' }, [PHASE]);
    expect(r).toEqual({ ok: true });
    expect(store.saveInputs).toHaveBeenCalledWith(PROJECT, {
      remainingWorks: '200000.000',
      materialsOnHand: null,
      phaseId: PHASE,
      phaseCost: '50000.000',
      protection: null,
      storage: null,
      restart: null,
      priceChangePct: '10',
    });
  });

  it('never calls the database when the input is invalid', async () => {
    const store = fakeStore();
    expect((await saveComparisonInputs(store, { projectId: PROJECT, priceChangePct: '500' }, [])).ok).toBe(false);
    expect(store.saveInputs).not.toHaveBeenCalled();
  });
});

describe('saveReview (S18.2)', () => {
  it('stores the ticked steps and the choice', async () => {
    const store = fakeStore();
    expect(await saveReview(store, { projectId: PROJECT, choice: 'pause', steps: ['siteAssessed'] })).toEqual({ ok: true });
    expect(store.saveReview).toHaveBeenCalledWith(PROJECT, {
      note: null,
      choice: 'pause',
      steps: { fundingConfirmed: false, contractsReviewed: false, siteAssessed: true, planDecided: false },
    });
  });
});

describe('buildComparison (S18.1): the timing rule for each scenario', () => {
  // 55,000 now; 30,000 due in 5 days; 40,000 expected in 10 days (the design's example).
  const cash = {
    liquidity: money('55000'),
    movements: [
      { kind: 'obligation' as const, amountLyd: '30000', date: '2026-11-25' },
      { kind: 'income' as const, amountLyd: '40000', date: '2026-11-30' },
    ],
  };

  it('shows the 30-day balance without a scenario, and each scenario with its cost now paid today', () => {
    const v = buildComparison(stored({ remainingWorks: '60000.000', protection: '2000.000', storage: '1000.000', restart: '2000.000' }), cash, noWarnings, TODAY);
    expect(v.base?.balanceAtEnd.toFixed(3)).toBe('65000.000');
    const [go, pause] = v.scenarios;
    // Continue: 60,000 today -> -5,000 at once, -35,000 on the 25th, back to +5,000 after the income.
    expect(go.outlook?.balanceAtEnd.toFixed(3)).toBe('5000.000');
    expect(go.outlook?.shortfall?.from).toBe(TODAY);
    expect(go.outlook?.shortfall?.lowest.toFixed(3)).toBe('-35000.000');
    // Pause: 5,000 today, no shortfall.
    expect(pause.outlook?.balanceAtEnd.toFixed(3)).toBe('60000.000');
    expect(pause.outlook?.shortfall).toBeNull();
  });

  it('without liquidity: costs, but no balance', () => {
    const v = buildComparison(stored({ remainingWorks: '1000.000' }), { liquidity: null, movements: [] }, noWarnings, TODAY);
    expect(v.base).toBeNull();
    expect(v.scenarios[0].costNow?.toFixed(3)).toBe('1000.000');
    expect(v.scenarios[0].outlook).toBeNull();
  });

  it('with nothing saved yet: every scenario says what is missing', () => {
    const v = buildComparison(null, cash, noWarnings, TODAY);
    expect(v.scenarios.every((s) => s.costNow === null && s.missing.includes('remainingWorks'))).toBe(true);
  });
});
