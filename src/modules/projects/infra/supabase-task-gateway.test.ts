import { describe, expect, it } from 'vitest';
import { mapTaskError, toPhaseTask } from './supabase-task-gateway';

describe('mapTaskError', () => {
  it('turns database codes into our reasons, never raw text', () => {
    expect(mapTaskError({ code: '42501' })).toBe('not_allowed');
    expect(mapTaskError({ code: '23503' })).toBe('unknown_reference');
    expect(mapTaskError({ code: '23514' })).toBe('rejected');
    expect(mapTaskError({ code: 'XX000' })).toBe('unavailable');
  });
});

describe('toPhaseTask', () => {
  it('maps a row and does not trust an unknown status', () => {
    const row = { id: 't1', phase_id: 'ph1', title: 'تجهيز الشدة', status: 'doing', due_date: '2026-11-25' };
    expect(toPhaseTask(row)).toEqual({ id: 't1', phaseId: 'ph1', title: 'تجهيز الشدة', status: 'doing', dueDate: '2026-11-25' });
    expect(toPhaseTask({ ...row, status: 'weird' }).status).toBe('todo');
  });
});
