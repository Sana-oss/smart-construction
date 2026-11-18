import type { SupabaseClient } from '@supabase/supabase-js';
import type { PhaseTask, TaskFailure, TaskGateway } from '../application/tasks';
import { isTaskStatus } from '../domain/tasks';

// Supabase adapter for phase tasks. Always used with the signed-in user's client: RLS decides what is visible and
// writable (0001 policies), and the guard trigger of 0012 keeps each task's phase inside its project.

interface TaskRow {
  id: string;
  phase_id: string | null;
  title: string;
  status: string;
  due_date: string | null;
}

/**
 * PostgreSQL error codes -> our failure reasons (no raw database text reaches the user, NFR-USE-04):
 *   42501 RLS refused the write · 23503 the phase is not in this project (0012 guard) · 23514/22007/22008 bad value
 */
export function mapTaskError(error: { code?: string }): TaskFailure {
  switch (error.code) {
    case '42501':
      return 'not_allowed';
    case '23503':
      return 'unknown_reference';
    case '23514':
    case '22007':
    case '22008':
      return 'rejected';
    default:
      return 'unavailable';
  }
}

export function toPhaseTask(row: TaskRow): PhaseTask {
  return {
    id: row.id,
    phaseId: row.phase_id,
    title: row.title,
    status: isTaskStatus(row.status) ? row.status : 'todo',
    dueDate: row.due_date,
  };
}

export function supabaseTaskGateway(supabase: SupabaseClient): TaskGateway {
  return {
    async projectTasks(projectId) {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, phase_id, title, status, due_date')
        .eq('project_id', projectId)
        .order('created_at')
        .returns<TaskRow[]>();
      if (error) throw new Error(`tasks unavailable: ${error.message}`);
      return (data ?? []).map(toPhaseTask);
    },

    async addTask(projectId, phaseId, task) {
      // done_at is never sent: the database sets it from the status (0012).
      const { error } = await supabase
        .from('tasks')
        .insert({ project_id: projectId, phase_id: phaseId, title: task.title, due_date: task.dueDate });
      return error ? { status: 'failed', reason: mapTaskError(error) } : { status: 'added' };
    },

    async setTaskStatus(taskId, status) {
      // .select('id'): RLS turns a refused update into "0 rows" rather than an error, so count the rows.
      const { data, error } = await supabase.from('tasks').update({ status }).eq('id', taskId).select('id');
      if (error) return { status: 'failed', reason: mapTaskError(error) };
      return (data ?? []).length === 1 ? { status: 'updated' } : { status: 'failed', reason: 'not_allowed' };
    },

    async deleteTask(taskId) {
      const { data, error } = await supabase.from('tasks').delete().eq('id', taskId).select('id');
      if (error) return { status: 'failed', reason: mapTaskError(error) };
      return (data ?? []).length === 1 ? { status: 'deleted' } : { status: 'failed', reason: 'not_allowed' };
    },
  };
}
