import { describe, expect, it } from 'vitest';
import {
  checklistProgress,
  checkPhotoStoragePath,
  isCheckPhotoPathOf,
  photoRequirement,
  readinessGaps,
  validateCheck,
  validateNewChecklist,
} from './checklist';

const PHASE = '7f1c0d2e-5b8a-4c3d-9e6f-1a2b3c4d5e6f';
const TEMPLATE = '3c2b1a09-8f7e-4d6c-9b5a-0f1e2d3c4b5a';
const known = { phase: (id: string) => id === PHASE, template: (id: string) => id === TEMPLATE };

describe('validateNewChecklist (FR-QLT-02)', () => {
  it('accepts a named checklist for a phase of the project, from a known template', () => {
    const r = validateNewChecklist({ title: ' صب  سقف الدور الأرضي ', phaseId: PHASE.toUpperCase(), templateId: TEMPLATE }, known);
    expect(r).toEqual({ ok: true, value: { title: 'صب سقف الدور الأرضي', phaseId: PHASE, templateId: TEMPLATE } });
  });

  it('reports every wrong field', () => {
    const r = validateNewChecklist({ title: 'x', phaseId: 'abc', templateId: '' }, known);
    expect(r.ok ? [] : r.errors).toEqual([
      { field: 'title', code: 'too_short' },
      { field: 'phaseId', code: 'invalid_reference' },
      { field: 'templateId', code: 'required' },
    ]);
  });
});

describe('validateCheck (FR-QLT-01, design S26.2)', () => {
  it('accepts a problem with its note, who fixes it and when it is checked again', () => {
    const r = validateCheck({ result: 'issue', note: ' تباعد  الكانات ', responsible: 'مقاول الهيكل', recheckOn: '2026-11-25' });
    expect(r).toEqual({ ok: true, value: { result: 'issue', note: 'تباعد الكانات', responsible: 'مقاول الهيكل', recheckOn: '2026-11-25' } });
  });

  it('a sound or not-applicable item needs nothing more', () => {
    expect(validateCheck({ result: 'ok' })).toEqual({ ok: true, value: { result: 'ok', note: null, responsible: null, recheckOn: null } });
    expect(validateCheck({ result: 'na' }).ok).toBe(true);
  });

  it('refuses a missing or unknown result and bad fields', () => {
    const empty = validateCheck({});
    expect(empty.ok ? [] : empty.errors).toEqual([{ field: 'result', code: 'required' }]);
    const r = validateCheck({ result: 'approved', note: 'ن'.repeat(201), responsible: 'م'.repeat(81), recheckOn: '25/11/2026' });
    expect(r.ok ? [] : r.errors).toEqual([
      { field: 'result', code: 'unknown_choice' },
      { field: 'note', code: 'too_long' },
      { field: 'responsible', code: 'too_long' },
      { field: 'recheckOn', code: 'invalid_date' },
    ]);
  });
});

describe('checklistProgress (design S26.1: «8 من 12 بندًا»)', () => {
  it('counts checked, problems and unchecked', () => {
    const p = checklistProgress([{ result: 'ok' }, { result: 'issue' }, { result: null }, { result: 'na' }]);
    expect(p).toEqual({ total: 4, checked: 3, issues: 1, unchecked: 1, complete: false });
  });

  it('is complete when every item has a result, problems included (D2: warn, never block)', () => {
    expect(checklistProgress([{ result: 'ok' }, { result: 'issue' }]).complete).toBe(true);
  });

  it('an empty list is not complete', () => {
    expect(checklistProgress([]).complete).toBe(false);
  });
});

describe('the item photo (FR-QLT-01, slice 2)', () => {
  const PROJECT = '0b9d3c1a-2e4f-4a6b-8c7d-9e0f1a2b3c4d';
  const PHOTO = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

  it("stores the photo in the project's checklists folder, and recognises only that", () => {
    const path = checkPhotoStoragePath(PROJECT, PHOTO);
    expect(path).toBe(`${PROJECT}/checklists/${PHOTO}.jpg`);
    expect(isCheckPhotoPathOf(PROJECT, path)).toBe(true);
    expect(isCheckPhotoPathOf(PHOTO, path)).toBe(false); // another project's folder
    expect(isCheckPhotoPathOf(PROJECT, `${PROJECT}/receipts/${PHOTO}.jpg`)).toBe(false);
    expect(isCheckPhotoPathOf(PROJECT, `${PROJECT}/checklists/../x.jpg`)).toBe(false);
    expect(() => checkPhotoStoragePath('x', PHOTO)).toThrow();
  });

  it('an item that requires a photo is not «سليم» without one; a problem or «لا ينطبق» is recorded as it is', () => {
    expect(photoRequirement('ok', true, false)).toBe('photo_required');
    expect(photoRequirement('ok', true, true)).toBeNull();
    expect(photoRequirement('ok', false, false)).toBeNull();
    expect(photoRequirement('issue', true, false)).toBeNull();
    expect(photoRequirement('na', true, false)).toBeNull();
  });
});

describe('readinessGaps (FR-PRJ-05)', () => {
  it('lists missing and unreviewed items in order; «متوفر» and «لا ينطبق» are not gaps', () => {
    expect(
      readinessGaps([
        { text: 'ترخيص البناء', result: 'issue', position: 3 },
        { text: 'فحص التربة', result: null, position: 1 },
        { text: 'مخططات معتمدة', result: 'ok', position: 2 },
        { text: 'عقد مقاول', result: 'na', position: 5 },
      ]),
    ).toEqual([
      { text: 'فحص التربة', state: 'unchecked' },
      { text: 'ترخيص البناء', state: 'missing' },
    ]);
  });
});
