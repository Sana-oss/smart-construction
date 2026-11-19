import { describe, expect, it } from 'vitest';
import { isTaskOverdue, nextTaskStatus, overallProgress, phaseProgress, progressByPhase, validateNewTask } from './tasks';

describe('phaseProgress (FR-PRJ-04)', () => {
  it('gives 25% for 4 tasks with 1 done (the requirement example)', () => {
    const p = phaseProgress([{ status: 'done' }, { status: 'doing' }, { status: 'todo' }, { status: 'todo' }]);
    expect(p).toEqual({ total: 4, done: 1, percent: 25 });
  });

  it('rounds down, so 2 of 3 is 66% and 99.x% never shows as 100%', () => {
    expect(phaseProgress([{ status: 'done' }, { status: 'done' }, { status: 'todo' }]).percent).toBe(66);
    const many = [...Array(199).fill({ status: 'done' }), { status: 'todo' }];
    expect(phaseProgress(many).percent).toBe(99);
  });

  it('is 100% only when every task is done', () => {
    expect(phaseProgress([{ status: 'done' }, { status: 'done' }]).percent).toBe(100);
  });

  it('has no percent for a phase without tasks', () => {
    expect(phaseProgress([])).toEqual({ total: 0, done: 0, percent: null });
  });
});

describe('nextTaskStatus', () => {
  it('starts, finishes, then reopens a task', () => {
    expect(nextTaskStatus('todo')).toBe('doing');
    expect(nextTaskStatus('doing')).toBe('done');
    expect(nextTaskStatus('done')).toBe('todo');
  });
});

describe('validateNewTask', () => {
  it('accepts a title and an optional due date, trimming spaces', () => {
    expect(validateNewTask({ title: '  تجهيز   الشدة ', dueDate: '2026-11-25' })).toEqual({
      ok: true,
      value: { title: 'تجهيز الشدة', dueDate: '2026-11-25' },
    });
    expect(validateNewTask({ title: 'طلب الحديد', dueDate: '' })).toEqual({ ok: true, value: { title: 'طلب الحديد', dueDate: null } });
  });

  it('allows a due date in the past (a task may already be late)', () => {
    expect(validateNewTask({ title: 'فحص التسليح', dueDate: '2026-01-01' }).ok).toBe(true);
  });

  it('requires a title of 2 to 120 characters', () => {
    expect(validateNewTask({ title: '   ' })).toEqual({ ok: false, errors: [{ field: 'title', code: 'required' }] });
    expect(validateNewTask({ title: 'ا' })).toEqual({ ok: false, errors: [{ field: 'title', code: 'too_short' }] });
    expect(validateNewTask({ title: 'ب'.repeat(121) })).toEqual({ ok: false, errors: [{ field: 'title', code: 'too_long' }] });
    expect(validateNewTask({ title: 'ب'.repeat(120) }).ok).toBe(true);
  });

  it('refuses a date that does not exist', () => {
    expect(validateNewTask({ title: 'طلب الحديد', dueDate: '2026-02-30' })).toEqual({
      ok: false,
      errors: [{ field: 'dueDate', code: 'invalid_date' }],
    });
  });
});

describe('isTaskOverdue', () => {
  const today = '2026-11-18';
  it('is overdue after its due date while not done', () => {
    expect(isTaskOverdue({ status: 'doing', dueDate: '2026-11-17' }, today)).toBe(true);
    expect(isTaskOverdue({ status: 'todo', dueDate: '2026-11-18' }, today)).toBe(false); // due today: not yet
    expect(isTaskOverdue({ status: 'done', dueDate: '2026-11-01' }, today)).toBe(false);
    expect(isTaskOverdue({ status: 'todo', dueDate: null }, today)).toBe(false);
  });
});

describe('progressByPhase', () => {
  it('groups the project tasks by phase and ignores tasks without a phase', () => {
    const m = progressByPhase([
      { phaseId: 'a', status: 'done' },
      { phaseId: 'a', status: 'todo' },
      { phaseId: 'b', status: 'doing' },
      { phaseId: null, status: 'done' },
    ]);
    expect(m.get('a')).toEqual({ total: 2, done: 1, percent: 50 });
    expect(m.get('b')).toEqual({ total: 1, done: 0, percent: 0 });
    expect(m.size).toBe(2);
  });
});

describe('overallProgress (S07.1, decision of 19 Nov)', () => {
  const phases = [
    { id: 'a', status: 'done' },
    { id: 'b', status: 'in_progress' },
    { id: 'c', status: 'not_started' },
    { id: 'd', status: 'not_started' },
  ];

  it('averages the phases with equal weight: 4 phases, one finished, one at 50% -> 37%', () => {
    const tasks = [
      { phaseId: 'b', status: 'done' as const },
      { phaseId: 'b', status: 'todo' as const },
    ];
    expect(overallProgress(phases, tasks)).toBe(37);
  });

  it('counts a phase in progress with no tasks as 0%, and a finished phase as 100% whatever its tasks', () => {
    expect(overallProgress(phases, [])).toBe(25);
    expect(overallProgress(phases, [{ phaseId: 'a', status: 'todo' }])).toBe(25);
  });

  it('is 100% only when every phase is finished', () => {
    expect(overallProgress([{ id: 'a', status: 'done' }, { id: 'b', status: 'done' }], [])).toBe(100);
    const almost = [{ id: 'a', status: 'done' }, { id: 'b', status: 'in_progress' }];
    const tasks = [...Array(99).fill({ phaseId: 'b', status: 'done' }), { phaseId: 'b', status: 'todo' }];
    expect(overallProgress(almost, tasks)).toBe(99);
  });

  it('gives exact thirds without drifting: 3 phases, one finished -> 33%', () => {
    expect(overallProgress([{ id: 'a', status: 'done' }, { id: 'b', status: 'todo' }, { id: 'c', status: 'todo' }], [])).toBe(33);
  });

  it('has no value without phases', () => {
    expect(overallProgress([], [])).toBeNull();
  });
});
