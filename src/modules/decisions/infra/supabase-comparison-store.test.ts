import { describe, expect, it } from 'vitest';
import { mapDecisionError, toStored } from './supabase-comparison-store';

const row = {
  remaining_works_lyd: '150000.000',
  materials_on_hand_lyd: null,
  phase_id: null,
  phase_cost_lyd: null,
  protection_lyd: '3000.000',
  storage_lyd: null,
  restart_lyd: null,
  price_change_pct: '-12.50',
  review_note: null,
  choice: 'finish_phase',
  funding_confirmed: true,
  contracts_reviewed: false,
  site_assessed: false,
  plan_decided: false,
};

describe('toStored', () => {
  it('keeps money as decimal strings and gives the percentage in its plain form', () => {
    const s = toStored(row);
    expect(s.inputs).toMatchObject({ remainingWorks: '150000.000', protection: '3000.000', priceChangePct: '-12.5' });
    expect(toStored({ ...row, price_change_pct: '10.00' }).inputs.priceChangePct).toBe('10');
    expect(toStored({ ...row, price_change_pct: '0.00' }).inputs.priceChangePct).toBe('0');
    expect(s.review).toEqual({
      note: null,
      choice: 'finish_phase',
      steps: { fundingConfirmed: true, contractsReviewed: false, siteAssessed: false, planDecided: false },
    });
  });

  it('ignores a choice it does not know', () => {
    expect(toStored({ ...row, choice: 'sell' }).review.choice).toBeNull();
  });
});

describe('mapDecisionError', () => {
  it.each([
    ['42501', 'not_allowed'],
    ['23503', 'unknown_reference'],
    ['23514', 'rejected'],
    ['XX000', 'unavailable'],
  ] as const)('maps %s to %s', (code, reason) => {
    expect(mapDecisionError({ code })).toBe(reason);
  });
});
