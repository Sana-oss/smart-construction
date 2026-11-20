import { describe, expect, it } from 'vitest';
import { contingencyUse, EXTRA_TITLE_MAX, validateExtra } from './extras';

const TODAY = '2026-11-20';
const PHASE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const fixed = (m: { toFixed: (n: number) => string }) => m.toFixed(3);

describe('validateExtra (FR-FIN-10)', () => {
  it('accepts a proposed extra work by default', () => {
    const r = validateExtra({ title: ' توسيع  الشرفة ', cost: '12,500', phaseId: PHASE.toUpperCase(), note: ' طلب المالك ' }, TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(fixed(r.value.costLyd)).toBe('12500.000');
    expect(r.value).toMatchObject({ title: 'توسيع الشرفة', status: 'proposed', phaseId: PHASE, occurredOn: null, note: 'طلب المالك' });
  });

  it('accepts an approved one with a past date', () => {
    const r = validateExtra({ title: 'نافذة إضافية', cost: '800', status: 'approved', occurredOn: '2026-11-01' }, TODAY);
    expect(r.ok && [r.value.status, r.value.occurredOn]).toEqual(['approved', '2026-11-01']);
  });

  it('reports every wrong field', () => {
    const r = validateExtra(
      { title: 'ب'.repeat(EXTRA_TITLE_MAX + 1), cost: '0', occurredOn: '2026-11-21', phaseId: 'x', status: 'paid', note: 'ن'.repeat(201) },
      TODAY,
    );
    expect(r.ok ? [] : r.errors).toEqual([
      { field: 'title', code: 'too_long' },
      { field: 'cost', code: 'must_be_positive' },
      { field: 'occurredOn', code: 'date_in_future' },
      { field: 'phaseId', code: 'invalid_id' },
      { field: 'status', code: 'unknown_choice' },
      { field: 'note', code: 'too_long' },
    ]);
  });
});

describe('contingencyUse (approved works come out of the contingency first)', () => {
  const run = (extras: { status: 'proposed' | 'approved' | 'rejected'; costLyd: string }[]) =>
    contingencyUse({ total: '450000', contingency: '22500', extras });

  it('takes approved works from the contingency; proposed and rejected count nowhere', () => {
    const u = run([
      { status: 'approved', costLyd: '10000' },
      { status: 'proposed', costLyd: '5000' },
      { status: 'rejected', costLyd: '99999' },
    ]);
    expect([fixed(u.approved), fixed(u.proposed), fixed(u.contingencyLeft), fixed(u.beyondContingency), u.usedUp, fixed(u.expectedTotal)]).toEqual([
      '10000.000',
      '5000.000',
      '12500.000',
      '0.000',
      false,
      '450000.000',
    ]);
  });

  it('past the contingency, the expected cost goes above the budget and the contingency is used up', () => {
    const u = run([
      { status: 'approved', costLyd: '20000' },
      { status: 'approved', costLyd: '7500' },
    ]);
    expect([fixed(u.contingencyLeft), fixed(u.beyondContingency), u.usedUp, fixed(u.expectedTotal)]).toEqual([
      '0.000',
      '5000.000',
      true,
      '455000.000',
    ]);
  });

  it('exactly the contingency uses it up, with nothing beyond', () => {
    const u = run([{ status: 'approved', costLyd: '22500' }]);
    expect([u.usedUp, fixed(u.beyondContingency), fixed(u.expectedTotal)]).toEqual([true, '0.000', '450000.000']);
  });

  it('nothing approved: nothing used, even with a zero contingency', () => {
    const u = contingencyUse({ total: '1000', contingency: '0', extras: [] });
    expect([u.usedUp, fixed(u.contingencyLeft)]).toEqual([false, '0.000']);
  });
});
