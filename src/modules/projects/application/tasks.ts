import { isTaskStatus, validateNewTask, type NewTask, type NewTaskError, type TaskStatus } from '../domain/tasks';

// Use cases: phase tasks (FR-PRJ-04, design S10.2). Run on the SERVER as the signed-in user: the gateway writes
// through RLS, and the database's guard (0012) keeps a task's phase inside its project.

export interface PhaseTask {
  id: string;
  phaseId: string | null;
  title: string;
  status: TaskStatus;
  /** "YYYY-MM-DD" or null */
  dueDate: string | null;
}

export type TaskFailure =
  | 'not_allowed' // not signed in, no write access, or the task is not visible (RLS)
  | 'unknown_reference' // the phase is not part of this project (guard of 0012)
  | 'rejected' // the database refused the values (its own check of the same rules)
  | 'unavailable';

/** Port: what these use cases need from storage. The Supabase adapter is infra/supabase-task-gateway.ts. */
export interface TaskGateway {
  /** All the project's tasks, oldest first (for the phases screen and each phase's page). */
  projectTasks(projectId: string): Promise<PhaseTask[]>;
  addTask(projectId: string, phaseId: string, task: NewTask): Promise<{ status: 'added' } | { status: 'failed'; reason: TaskFailure }>;
  setTaskStatus(taskId: string, status: TaskStatus): Promise<{ status: 'updated' } | { status: 'failed'; reason: TaskFailure }>;
  deleteTask(taskId: string): Promise<{ status: 'deleted' } | { status: 'failed'; reason: TaskFailure }>;
}

export type TaskResult =
  | { ok: true }
  | { ok: false; kind: 'invalid'; errors: NewTaskError[] }
  | { ok: false; kind: 'failed'; reason: TaskFailure };

export async function addTask(
  gateway: TaskGateway,
  projectId: string,
  phaseId: string,
  input: { title?: string | null; dueDate?: string | null },
): Promise<TaskResult> {
  const checked = validateNewTask(input);
  if (!checked.ok) return { ok: false, kind: 'invalid', errors: checked.errors };
  const outcome = await gateway.addTask(projectId, phaseId, checked.value);
  return outcome.status === 'added' ? { ok: true } : { ok: false, kind: 'failed', reason: outcome.reason };
}

/** The status comes from a form: anything but todo/doing/done is refused before reaching the database. */
export async function changeTaskStatus(gateway: TaskGateway, taskId: string, status: unknown): Promise<TaskResult> {
  if (!isTaskStatus(status)) return { ok: false, kind: 'failed', reason: 'rejected' };
  const outcome = await gateway.setTaskStatus(taskId, status);
  return outcome.status === 'updated' ? { ok: true } : { ok: false, kind: 'failed', reason: outcome.reason };
}

export async function removeTask(gateway: TaskGateway, taskId: string): Promise<TaskResult> {
  const outcome = await gateway.deleteTask(taskId);
  return outcome.status === 'deleted' ? { ok: true } : { ok: false, kind: 'failed', reason: outcome.reason };
}
