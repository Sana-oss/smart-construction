import { describe, expect, it } from 'vitest';
import { addDays, cashflowOutlook, currentLiquidity, MOVEMENT_TEXT_MAX, validateMovement, type Movement } from './cashflow';

const TODAY = '2026-11-19';
const fixed = (m: { toFixed: (n: number) => string }) => m.toFixed(3);

describe('validateMovement (design S16.2)', () => {
  const ok = { kind: 'income', title: ' دفعة  تمويل ', amount: '٤٠٬٠٠٠', date: '2026-11-25', party: 'مالك المشروع' };

  it('accepts the five fields and cleans the text', () => {
    const r = validateMovement(ok);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(fixed(r.value.amountLyd)).toBe('40000.000');
    expect(r.value).toMatchObject({ kind: 'income', title: 'دفعة تمويل', date: '2026-11-25', party: 'مالك المشروع' });
  });

  it('allows a past date (an overdue obligation is still owed)', () => {
    expect(validateMovement({ ...ok, kind: 'obligation', date: '2026-10-01' }).ok).toBe(true);
  });

  it('reports every missing or wrong field', () => {
    const r = validateMovement({ kind: 'gift', title: 'x', amount: '0', date: '2026-02-30', party: 'ب'.repeat(MOVEMENT_TEXT_MAX + 1) });
    expect(r.ok ? [] : r.errors).toEqual([
      { field: 'kind', code: 'unknown_choice' },
      { field: 'title', code: 'too_short' },
      { field: 'amount', code: 'must_be_positive' },
      { field: 'date', code: 'invalid_date' },
      { field: 'party', code: 'too_long' },
    ]);
    expect(validateMovement({}).ok ? [] : (validateMovement({}) as { errors: unknown[] }).errors).toHaveLength(5);
  });
});

describe('addDays', () => {
  it('crosses months and years', () => {
    expect(addDays('2026-11-19', 30)).toBe('2026-12-19');
    expect(addDays('2026-12-20', 30)).toBe('2027-01-19');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('currentLiquidity («السيولة الحالية»)', () => {
  it('is the available figure minus expenses paid on or after its date', () => {
    const l = currentLiquidity('55000', '2026-11-10', [
      { amountLyd: '5000', paidOn: '2026-11-09' }, // before the figure: already outside it
      { amountLyd: '1250.5', paidOn: '2026-11-10' },
      { amountLyd: '3000', paidOn: '2026-11-18' },
    ]);
    expect(l && fixed(l.amount)).toBe('50749.500');
    expect(l?.asOf).toBe('2026-11-10');
  });

  it('is missing when the owner never gave the figure', () => {
    expect(currentLiquidity(null, null, [])).toBeNull();
  });
});

describe('cashflowOutlook (S16.1, S18.1; timing rule of FR-DEC-01)', () => {
  it("matches the design's example: 55,000 + 40,000 − 30,000 = 65,000", () => {
    const movements: Movement[] = [
      { kind: 'obligation', amountLyd: '15000', date: '2026-11-16' }, // overdue: due today at the latest
      { kind: 'obligation', amountLyd: '15000', date: '2026-11-20' },
      { kind: 'income', amountLyd: '40000', date: '2026-11-25' },
    ];
    const o = cashflowOutlook('55000', movements, TODAY);
    expect(o.until).toBe('2026-12-19');
    expect(fixed(o.income)).toBe('40000.000');
    expect(fixed(o.obligations)).toBe('30000.000');
    expect(fixed(o.balanceAtEnd)).toBe('65000.000');
    expect(o.overdueObligations).toBe(1);
    expect(o.shortfall).toBeNull();
  });

  it('income that arrives after an obligation does not cover it', () => {
    const o = cashflowOutlook(
      '10000',
      [
        { kind: 'income', amountLyd: '50000', date: '2026-11-30' },
        { kind: 'obligation', amountLyd: '25000', date: '2026-11-22' },
        { kind: 'obligation', amountLyd: '5000', date: '2026-11-25' },
      ],
      TODAY,
    );
    expect(fixed(o.balanceAtEnd)).toBe('30000.000'); // fine at the end ...
    expect(o.shortfall?.from).toBe('2026-11-22'); // ... but short from the 22nd
    expect(o.shortfall && fixed(o.shortfall.lowest)).toBe('-20000.000');
  });

  it('on the same day, pays the obligation before counting the income', () => {
    const o = cashflowOutlook(
      '0',
      [
        { kind: 'income', amountLyd: '100', date: '2026-11-20' },
        { kind: 'obligation', amountLyd: '100', date: '2026-11-20' },
      ],
      TODAY,
    );
    expect(o.shortfall).toEqual({ from: '2026-11-20', lowest: expect.anything() });
    expect(fixed(o.balanceAtEnd)).toBe('0.000');
  });

  it('leaves out what falls after the 30 days', () => {
    const o = cashflowOutlook('1000', [{ kind: 'obligation', amountLyd: '5000', date: '2026-12-20' }], TODAY);
    expect(fixed(o.obligations)).toBe('0.000');
    expect(o.shortfall).toBeNull();
  });

  it('reports a negative starting balance as a shortfall from today', () => {
    const o = cashflowOutlook('-500', [], TODAY);
    expect(o.shortfall?.from).toBe(TODAY);
  });
});
