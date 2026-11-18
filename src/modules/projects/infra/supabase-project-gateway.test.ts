import { describe, expect, it } from 'vitest';
import { toProjectPhase } from './supabase-project-gateway';

describe('toProjectPhase', () => {
  it('keeps the dates as "YYYY-MM-DD" text and empty dates as null', () => {
    expect(
      toProjectPhase({
        id: 'ph1',
        position: 2,
        name: 'الهيكل الخرساني',
        status: 'in_progress',
        planned_start: '2026-10-01',
        planned_end: '2026-11-10',
        actual_start: '2026-10-03',
        actual_end: null,
      }),
    ).toEqual({
      id: 'ph1',
      position: 2,
      name: 'الهيكل الخرساني',
      status: 'in_progress',
      plannedStart: '2026-10-01',
      plannedEnd: '2026-11-10',
      actualStart: '2026-10-03',
      actualEnd: null,
    });
  });
});
