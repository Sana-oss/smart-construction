import { describe, expect, it } from 'vitest';
import { nextStep, type NextStepPhase, type NextStepTask } from './next-step';

const TODAY = '2026-11-19';
const phase = (p: Partial<NextStepPhase> & { id: string; position: number }): NextStepPhase => ({
  name: `مرحلة ${p.position}`,
  status: 'not_started',
  plannedStart: null,
  plannedEnd: null,
  actualStart: null,
  actualEnd: null,
  ...p,
});
const task = (t: Partial<NextStepTask>): NextStepTask => ({ phaseId: 'b', title: 'مهمة', status: 'todo', dueDate: null, ...t });

const planned = [
  phase({ id: 'a', position: 1, status: 'done' }),
  phase({ id: 'b', position: 2, status: 'in_progress', plannedStart: '2026-11-01', plannedEnd: '2026-12-31' }),
  phase({ id: 'c', position: 3 }),
];

describe('nextStep (FR-DSH-02, order of 19 Nov)', () => {
  it('1. asks for the first expense before anything else (the requirement example)', () => {
    const late = [phase({ id: 'b', position: 2, status: 'in_progress', plannedEnd: '2026-11-01' })];
    expect(nextStep({ expensesRecorded: false, phases: late, tasks: [], today: TODAY })).toEqual({ kind: 'first_expense' });
  });

  it('2. points at a phase running late, the earliest in the plan', () => {
    const phases = [
      phase({ id: 'c', position: 3, name: 'المباني', status: 'not_started', plannedStart: '2026-11-10' }),
      phase({ id: 'b', position: 2, name: 'الهيكل', status: 'in_progress', plannedEnd: '2026-11-15' }),
    ];
    expect(nextStep({ expensesRecorded: true, phases, tasks: [task({ dueDate: '2026-11-01' })], today: TODAY })).toEqual({
      kind: 'late_phase',
      phaseId: 'b',
      phaseName: 'الهيكل',
    });
  });

  it('does not count a phase that finished late as "running late now"', () => {
    const phases = [phase({ id: 'a', position: 1, status: 'done', plannedEnd: '2026-11-01', actualEnd: '2026-11-05' }), ...planned.slice(1)];
    expect(nextStep({ expensesRecorded: true, phases, tasks: [], today: TODAY }).kind).toBe('daily_expense');
  });

  it('3. then the task past its due date that was due earliest', () => {
    const tasks = [
      task({ title: 'صب السقف', dueDate: '2026-11-17' }),
      task({ title: 'تجهيز الشدة', dueDate: '2026-11-12' }),
      task({ title: 'منجزة', dueDate: '2026-11-01', status: 'done' }),
      task({ title: 'اليوم', dueDate: TODAY }),
    ];
    expect(nextStep({ expensesRecorded: true, phases: planned, tasks, today: TODAY })).toEqual({
      kind: 'overdue_task',
      phaseId: 'b',
      taskTitle: 'تجهيز الشدة',
    });
  });

  it('4. then asks for the current phase dates when it has none', () => {
    const phases = [phase({ id: 'a', position: 1, status: 'done' }), phase({ id: 'b', position: 2, name: 'الهيكل', status: 'in_progress' })];
    expect(nextStep({ expensesRecorded: true, phases, tasks: [], today: TODAY })).toEqual({
      kind: 'set_dates',
      phaseId: 'b',
      phaseName: 'الهيكل',
    });
  });

  it('5. otherwise suggests recording today\'s expenses', () => {
    expect(nextStep({ expensesRecorded: true, phases: planned, tasks: [], today: TODAY })).toEqual({ kind: 'daily_expense' });
    expect(nextStep({ expensesRecorded: true, phases: [], tasks: [], today: TODAY })).toEqual({ kind: 'daily_expense' });
  });
});
