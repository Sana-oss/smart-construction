import { isIsoDate } from '@/shared-kernel';

// Phase tasks (FR-PRJ-04: "مهام لكل مرحلة (عنوان، حالة، موعد) ونسبة إنجاز تُحسب منها").
// Pure: no React, no database. Statuses are the table's (0001): todo, doing, done.

export type TaskStatus = 'todo' | 'doing' | 'done';
export const TASK_STATUSES: readonly TaskStatus[] = ['todo', 'doing', 'done'];

export const TASK_TITLE_MIN = 2;
export const TASK_TITLE_MAX = 120;

export interface PhaseProgress {
  total: number;
  done: number;
  /** Whole percent, rounded DOWN so a phase never shows 100% before its last task is done. Null without tasks. */
  percent: number | null;
}

/** «نسبة إنجاز المرحلة»: done tasks / all tasks. FR-PRJ-04 example: 4 tasks, 1 done -> 25%. */
export function phaseProgress(tasks: readonly { status: TaskStatus }[]): PhaseProgress {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'done').length;
  return { total, done, percent: total === 0 ? null : Math.floor((done * 100) / total) };
}

/** The one action a task row offers: start it, finish it, or reopen it. */
export function nextTaskStatus(status: TaskStatus): TaskStatus {
  return status === 'todo' ? 'doing' : status === 'doing' ? 'done' : 'todo';
}

export const isTaskStatus = (v: unknown): v is TaskStatus => (TASK_STATUSES as readonly unknown[]).includes(v);

export type NewTaskField = 'title' | 'dueDate';
export type NewTaskErrorCode = 'required' | 'too_short' | 'too_long' | 'invalid_date';
export interface NewTaskError {
  field: NewTaskField;
  code: NewTaskErrorCode;
}

export interface NewTask {
  title: string;
  /** "YYYY-MM-DD" or null. A past date is allowed: the owner may record a task that is already late. */
  dueDate: string | null;
}

export type NewTaskResult = { ok: true; value: NewTask } | { ok: false; errors: NewTaskError[] };

/** Title: 2–120 characters after trimming (spaces inside are kept as typed, runs collapsed). Due date optional. */
export function validateNewTask(input: { title?: string | null; dueDate?: string | null }): NewTaskResult {
  const errors: NewTaskError[] = [];
  const title = (input.title ?? '').trim().replace(/\s+/g, ' ');
  if (title === '') errors.push({ field: 'title', code: 'required' });
  else if ([...title].length < TASK_TITLE_MIN) errors.push({ field: 'title', code: 'too_short' });
  else if ([...title].length > TASK_TITLE_MAX) errors.push({ field: 'title', code: 'too_long' });

  const rawDate = (input.dueDate ?? '').trim();
  const dueDate = rawDate === '' ? null : rawDate;
  if (dueDate !== null && !isIsoDate(dueDate)) errors.push({ field: 'dueDate', code: 'invalid_date' });

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: { title, dueDate } };
}

/** A task is overdue when its due date has passed (before today in Libya) and it is not done. */
export function isTaskOverdue(task: { status: TaskStatus; dueDate: string | null }, today: string): boolean {
  return task.status !== 'done' && task.dueDate !== null && task.dueDate < today;
}

/** Progress of every phase from the project's tasks: phase id -> progress. Phases without tasks are absent. */
export function progressByPhase(tasks: readonly { phaseId: string | null; status: TaskStatus }[]): Map<string, PhaseProgress> {
  const groups = new Map<string, { status: TaskStatus }[]>();
  for (const t of tasks) {
    if (t.phaseId === null) continue;
    const list = groups.get(t.phaseId) ?? [];
    list.push(t);
    groups.set(t.phaseId, list);
  }
  return new Map([...groups].map(([id, list]) => [id, phaseProgress(list)]));
}
