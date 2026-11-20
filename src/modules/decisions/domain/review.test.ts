import { describe, expect, it } from 'vitest';
import { validateReview } from './review';

describe('validateReview (design S18.2, owner-only checklist)', () => {
  it('keeps the ticked steps, the note and the chosen way', () => {
    const r = validateReview({ note: ' بانتظار تأكيد التمويل ', choice: 'finish_phase', steps: ['fundingConfirmed', 'planDecided', 'unknown'] });
    expect(r).toEqual({
      ok: true,
      value: {
        note: 'بانتظار تأكيد التمويل',
        choice: 'finish_phase',
        steps: { fundingConfirmed: true, contractsReviewed: false, siteAssessed: false, planDecided: true },
      },
    });
  });

  it('allows no choice yet, and refuses an unknown one or a long note', () => {
    expect(validateReview({}).ok).toBe(true);
    const r = validateReview({ choice: 'sell', note: 'ن'.repeat(501) });
    expect(r.ok ? [] : r.errors).toEqual([
      { field: 'note', code: 'too_long' },
      { field: 'choice', code: 'unknown_choice' },
    ]);
  });
});
