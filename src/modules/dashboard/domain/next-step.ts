import { currentPhaseOf, isTaskOverdue, phaseDelay, type PhaseSchedule, type TaskStatus } from '@/modules/projects';

// «الخطوة التالية» on the dashboard (FR-DSH-02: ONE clear next step for the project's state; design S07.1).
// Order approved by the owner on 19 Nov 2026 (change register), first match wins:
//   1. no expense recorded in the app yet  -> record the first expense (FR-DSH-02's own example)
//   2. a phase is running late now          -> look at that phase (the earliest in the plan)
//   3. a task is past its due date          -> finish that task (the one due earliest)
//   4. the current phase has no dates       -> set its dates, so delays can be seen
//   5. otherwise                            -> record today's expenses
// Pure: everything is passed in; the date is the date in Libya.

export interface NextStepPhase extends PhaseSchedule {
  id: string;
  name: string;
  position: number;
}

export interface NextStepTask {
  phaseId: string | null;
  title: string;
  status: TaskStatus;
  dueDate: string | null;
}

export type NextStep =
  | { kind: 'first_expense' }
  | { kind: 'late_phase'; phaseId: string; phaseName: string }
  | { kind: 'overdue_task'; phaseId: string | null; taskTitle: string }
  | { kind: 'set_dates'; phaseId: string; phaseName: string }
  | { kind: 'daily_expense' };

export function nextStep(input: {
  expensesRecorded: boolean;
  phases: readonly NextStepPhase[];
  tasks: readonly NextStepTask[];
  today: string;
}): NextStep {
  if (!input.expensesRecorded) return { kind: 'first_expense' };

  const byPlan = [...input.phases].sort((a, b) => a.position - b.position);
  const late = byPlan.find((p) => {
    const d = phaseDelay(p, input.today);
    return d.kind === 'late' && d.ongoing;
  });
  if (late) return { kind: 'late_phase', phaseId: late.id, phaseName: late.name };

  const overdue = input.tasks
    .filter((t) => isTaskOverdue(t, input.today))
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))[0];
  if (overdue) return { kind: 'overdue_task', phaseId: overdue.phaseId, taskTitle: overdue.title };

  const current = currentPhaseOf(byPlan);
  if (current && !current.plannedStart && !current.plannedEnd) {
    return { kind: 'set_dates', phaseId: current.id, phaseName: current.name };
  }
  return { kind: 'daily_expense' };
}
