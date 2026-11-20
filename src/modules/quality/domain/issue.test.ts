import { describe, expect, it } from 'vitest';
import { isIssueStatus, isOpenIssue, sortIssues, validateIssue } from './issue';

const PHASE = '7f1c0d2e-5b8a-4c3d-9e6f-1a2b3c4d5e6f';
const LIST = '3c2b1a09-8f7e-4d6c-9b5a-0f1e2d3c4b5a';
const known = { phase: (id: string) => id === PHASE, checklist: (id: string) => id === LIST };

describe('validateIssue (FR-QLT-06, design S28.2)', () => {
  it('accepts a defect with its place, who fixes it, priority, phase and due date', () => {
    const r = validateIssue(
      {
        title: ' مراجعة  تسليح السقف ',
        location: 'الدور الأرضي · المحور ب',
        description: 'تباعد الكانات أكبر من المخطط',
        responsible: 'مقاول الهيكل',
        severity: 'critical',
        phaseId: PHASE,
        dueOn: '2026-12-01',
        checklistId: LIST,
      },
      known,
    );
    expect(r).toEqual({
      ok: true,
      value: {
        title: 'مراجعة تسليح السقف',
        location: 'الدور الأرضي · المحور ب',
        description: 'تباعد الكانات أكبر من المخطط',
        responsible: 'مقاول الهيكل',
        severity: 'critical',
        phaseId: PHASE,
        dueOn: '2026-12-01',
        checklistId: LIST,
      },
    });
  });

  it('needs only a title and a priority', () => {
    const r = validateIssue({ title: 'شرخ في الجدار', severity: 'minor' }, known);
    expect(r.ok && [r.value.phaseId, r.value.location, r.value.checklistId]).toEqual([null, null, null]);
  });

  it('reports every wrong field', () => {
    const r = validateIssue(
      { title: 'x', location: 'م'.repeat(81), description: 'و'.repeat(501), severity: 'urgent', phaseId: 'abc', dueOn: '1/12/2026', checklistId: PHASE },
      known,
    );
    expect(r.ok ? [] : r.errors).toEqual([
      { field: 'title', code: 'too_short' },
      { field: 'location', code: 'too_long' },
      { field: 'description', code: 'too_long' },
      { field: 'severity', code: 'unknown_choice' },
      { field: 'phaseId', code: 'invalid_reference' },
      { field: 'dueOn', code: 'invalid_date' },
      { field: 'checklistId', code: 'invalid_reference' },
    ]);
  });
});

describe('issue states and order (FR-QLT-06, FR-QLT-07, design S28.1)', () => {
  it('knows the three states; an unknown state is refused', () => {
    expect(['open', 'in_progress', 'closed', 'resolved'].map(isIssueStatus)).toEqual([true, true, true, false]);
  });

  it('counts open and in progress as unresolved', () => {
    expect(['open', 'in_progress', 'closed'].map((s) => isOpenIssue({ status: s as 'open' }))).toEqual([true, true, false]);
  });

  it('lists unresolved first, then the higher priority, then the newest', () => {
    const list = sortIssues([
      { id: 'a', status: 'closed' as const, severity: 'critical' as const, createdAt: '2026-11-03' },
      { id: 'b', status: 'open' as const, severity: 'minor' as const, createdAt: '2026-11-05' },
      { id: 'c', status: 'open' as const, severity: 'critical' as const, createdAt: '2026-11-01' },
      { id: 'd', status: 'in_progress' as const, severity: 'major' as const, createdAt: '2026-11-04' },
      { id: 'e', status: 'open' as const, severity: 'minor' as const, createdAt: '2026-11-06' },
    ]);
    expect(list.map((i) => i.id)).toEqual(['c', 'e', 'b', 'd', 'a']);
  });
});
