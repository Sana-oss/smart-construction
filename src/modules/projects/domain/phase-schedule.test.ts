import { describe, expect, it } from 'vitest';
import { daysBetween, phaseDelay, phasesOverview, validatePhaseSchedule, type PhaseSchedule } from './phase-schedule';

const TODAY = '2026-11-18';
const phase = (p: Partial<PhaseSchedule>): PhaseSchedule => ({
  status: 'in_progress',
  plannedStart: null,
  plannedEnd: null,
  actualStart: null,
  actualEnd: null,
  ...p,
});

describe('daysBetween', () => {
  it('counts whole calendar days, across months and years', () => {
    expect(daysBetween('2026-11-18', '2026-11-18')).toBe(0);
    expect(daysBetween('2026-11-28', '2026-12-03')).toBe(5);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2026-11-20', '2026-11-18')).toBe(-2);
  });
});

describe('phaseDelay (FR-PRJ-03: difference between planned and actual)', () => {
  it('is unknown without any planned date', () => {
    expect(phaseDelay(phase({ actualStart: '2026-11-01' }), TODAY)).toEqual({ kind: 'unknown' });
  });

  it('compares the actual end with the planned end when both are known', () => {
    const late = phaseDelay(phase({ status: 'done', plannedEnd: '2026-11-10', actualEnd: '2026-11-15' }), TODAY);
    expect(late).toEqual({ kind: 'late', days: 5, basis: 'finish', ongoing: false });
    const early = phaseDelay(phase({ status: 'done', plannedEnd: '2026-11-10', actualEnd: '2026-11-08' }), TODAY);
    expect(early).toEqual({ kind: 'early', days: 2, basis: 'finish' });
    const onTime = phaseDelay(phase({ status: 'done', plannedEnd: '2026-11-10', actualEnd: '2026-11-10' }), TODAY);
    expect(onTime).toEqual({ kind: 'on_time', basis: 'finish' });
  });

  it('counts a phase still running after its planned end as late until today', () => {
    const d = phaseDelay(phase({ plannedStart: '2026-10-01', plannedEnd: '2026-11-10', actualStart: '2026-10-01' }), TODAY);
    expect(d).toEqual({ kind: 'late', days: 8, basis: 'finish', ongoing: true });
  });

  it('does not count a phase marked done without dates as late (phases finished before the app)', () => {
    expect(phaseDelay(phase({ status: 'done', plannedEnd: '2026-11-10' }), TODAY)).toEqual({ kind: 'on_time', basis: 'plan' });
  });

  it('uses the start when the finish cannot be compared yet', () => {
    const d = phaseDelay(phase({ plannedStart: '2026-11-01', plannedEnd: '2026-12-31', actualStart: '2026-11-04' }), TODAY);
    expect(d).toEqual({ kind: 'late', days: 3, basis: 'start', ongoing: false });
  });

  it('counts a phase that should have started but has not as late until today', () => {
    const d = phaseDelay(phase({ status: 'not_started', plannedStart: '2026-11-15' }), TODAY);
    expect(d).toEqual({ kind: 'late', days: 3, basis: 'start', ongoing: true });
  });

  it('is on time while the planned dates are still ahead', () => {
    const d = phaseDelay(phase({ status: 'not_started', plannedStart: '2026-12-01', plannedEnd: '2027-01-15' }), TODAY);
    expect(d).toEqual({ kind: 'on_time', basis: 'plan' });
  });

  it('is not late on the planned day itself', () => {
    expect(phaseDelay(phase({ plannedEnd: TODAY }), TODAY)).toEqual({ kind: 'on_time', basis: 'plan' });
  });

  it('counts a blocked phase past its planned end as late (a pause does not stop the calendar)', () => {
    const d = phaseDelay(phase({ status: 'blocked', plannedEnd: '2026-11-17' }), TODAY);
    expect(d).toEqual({ kind: 'late', days: 1, basis: 'finish', ongoing: true });
  });
});

describe('validatePhaseSchedule', () => {
  it('accepts a status and any empty or valid dates', () => {
    const r = validatePhaseSchedule(
      { status: 'in_progress', plannedStart: '2026-11-01', plannedEnd: '2027-01-31', actualStart: ' 2026-11-03 ', actualEnd: '' },
      TODAY,
    );
    expect(r).toEqual({
      ok: true,
      value: { status: 'in_progress', plannedStart: '2026-11-01', plannedEnd: '2027-01-31', actualStart: '2026-11-03', actualEnd: null },
    });
  });

  it('refuses an unknown status (FR-PRJ-03: an invalid status is refused)', () => {
    const r = validatePhaseSchedule({ status: 'finished' }, TODAY);
    expect(r).toEqual({ ok: false, errors: [{ field: 'status', code: 'unknown_status' }] });
  });

  it('refuses a date that does not exist', () => {
    const r = validatePhaseSchedule({ status: 'not_started', plannedStart: '2026-02-30' }, TODAY);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toEqual([{ field: 'plannedStart', code: 'invalid_date' }]);
  });

  it('refuses an end before its start, for the plan and for what happened', () => {
    const r = validatePhaseSchedule(
      { status: 'done', plannedStart: '2026-11-10', plannedEnd: '2026-11-01', actualStart: '2026-11-10', actualEnd: '2026-11-05' },
      TODAY,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual({ field: 'plannedEnd', code: 'end_before_start' });
      expect(r.errors).toContainEqual({ field: 'actualEnd', code: 'end_before_start' });
    }
  });

  it('refuses actual dates after today, but allows planned dates in the future', () => {
    const r = validatePhaseSchedule({ status: 'in_progress', plannedEnd: '2027-03-01', actualStart: '2026-11-19' }, TODAY);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toEqual([{ field: 'actualStart', code: 'date_in_future' }]);
  });

  it('lets the status and the dates disagree (the owner keeps what they know, D2)', () => {
    expect(validatePhaseSchedule({ status: 'in_progress' }, TODAY).ok).toBe(true);
    expect(validatePhaseSchedule({ status: 'not_started', actualStart: '2026-11-01' }, TODAY).ok).toBe(true);
  });
});

describe('phasesOverview', () => {
  it('counts finished and late phases', () => {
    const o = phasesOverview(
      [
        phase({ status: 'done' }),
        phase({ status: 'in_progress', plannedEnd: '2026-11-10' }), // late, ongoing
        phase({ status: 'not_started', plannedStart: '2026-12-01' }), // ahead
        phase({ status: 'done', plannedEnd: '2026-10-01', actualEnd: '2026-10-05' }), // finished late
      ],
      TODAY,
    );
    expect(o).toEqual({ total: 4, done: 2, late: 2 });
  });
});
