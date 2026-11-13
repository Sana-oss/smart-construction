import { describe, expect, it } from 'vitest';
import { toDb } from '@/shared-kernel';
import { validateBudget, validateProjectDetails } from './project-setup';

describe('validateProjectDetails (S02.1)', () => {
  const good = { name: '  فيلا   النخيل ', city: 'طرابلس', projectType: 'new', buildingArea: '٢٤٠٫٥' };

  it('normalizes the details', () => {
    expect(validateProjectDetails(good)).toEqual({
      ok: true,
      value: { name: 'فيلا النخيل', city: 'طرابلس', projectType: 'new', buildingAreaM2: '240.5' },
    });
  });

  it('uses the free-text city when "other" is chosen', () => {
    const r = validateProjectDetails({ ...good, city: 'other', otherCity: ' قصر بن غشير ' });
    expect(r.ok && r.value.city).toBe('قصر بن غشير');
  });

  it('reports every problem at once', () => {
    expect(validateProjectDetails({ name: 'x', city: 'باريس', projectType: 'villa', buildingArea: '0' })).toEqual({
      ok: false,
      errors: [
        { field: 'name', code: 'too_short' },
        { field: 'city', code: 'unknown_choice' },
        { field: 'projectType', code: 'unknown_choice' },
        { field: 'buildingArea', code: 'must_be_positive' },
      ],
    });
  });

  it('requires the "other" city text and limits area decimals', () => {
    expect(validateProjectDetails({ ...good, city: 'other', otherCity: '' })).toMatchObject({
      errors: [{ field: 'otherCity', code: 'required' }],
    });
    expect(validateProjectDetails({ ...good, buildingArea: '240.555' })).toMatchObject({
      errors: [{ field: 'buildingArea', code: 'invalid_number' }],
    });
  });

  it('accepts an add-a-floor project', () => {
    expect(validateProjectDetails({ ...good, projectType: 'add_floor' }).ok).toBe(true);
  });
});

describe('validateBudget (S02.3)', () => {
  const good = { totalBudget: '450,000', availableNow: '180000', spentBefore: '١٢٥٬٠٠٠', contingencyPct: '10' };

  it('parses money as Decimal (never a JS number)', () => {
    const r = validateBudget(good);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(toDb(r.value.totalBudget)).toBe('450000.000');
    expect(toDb(r.value.spentBefore)).toBe('125000.000');
    expect(r.value.overBudget).toBe(false);
  });

  it('flags (does not reject) spending above the total budget (decision D2)', () => {
    const r = validateBudget({ ...good, spentBefore: '450000.001' });
    expect(r.ok && r.value.overBudget).toBe(true);
  });

  it('rejects zero total, bad numbers, out-of-range contingency and oversized amounts', () => {
    expect(validateBudget({ totalBudget: '0', availableNow: 'abc', spentBefore: '-1', contingencyPct: '101' })).toEqual({
      ok: false,
      errors: [
        { field: 'totalBudget', code: 'must_be_positive' },
        { field: 'availableNow', code: 'invalid_number' },
        { field: 'spentBefore', code: 'invalid_number' },
        { field: 'contingencyPct', code: 'percent_out_of_range' },
      ],
    });
    expect(validateBudget({ ...good, totalBudget: '123456789012' })).toMatchObject({
      errors: [{ field: 'totalBudget', code: 'too_large' }],
    });
    expect(validateBudget({ ...good, contingencyPct: '10.555' })).toMatchObject({
      errors: [{ field: 'contingencyPct', code: 'percent_out_of_range' }],
    });
  });

  it('requires every amount', () => {
    expect(validateBudget({})).toMatchObject({ ok: false, errors: { length: 4 } });
  });
});
