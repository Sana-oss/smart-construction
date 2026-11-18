'use server';

// Server Actions for phase tasks (FR-PRJ-04). Run as the signed-in user: RLS decides who may write, and the
// values from the form are checked again by the domain rules.

import { revalidatePath } from 'next/cache';
import { isUuid } from '@/shared-kernel';
import { createServerSupabase } from '@/platform/supabase/server';
import type { NewTaskField } from '../domain/tasks';
import { addTask, changeTaskStatus, removeTask, type TaskResult } from '../application/tasks';
import { supabaseProjectGateway } from '../infra/supabase-project-gateway';
import { supabaseTaskGateway } from '../infra/supabase-task-gateway';
import { newTaskErrorsAr, taskFailedAr } from './messages.ar';
import { phasePath } from './routes';

export interface TaskFormState {
  formError?: string;
  fieldErrors?: Partial<Record<NewTaskField, string>>;
  values?: Partial<Record<NewTaskField, string>>;
  /** Counts successful adds: the form uses it as a key, so it empties itself after each new task. */
  added?: number;
}

const text = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === 'string' ? v : '';
};

function failureMessage(result: Extract<TaskResult, { ok: false }>): string {
  return result.kind === 'failed' ? taskFailedAr[result.reason] : taskFailedAr.rejected;
}

/** Bound by the page: `addTaskAction.bind(null, phaseId)`. The project is the signed-in owner's own. */
export async function addTaskAction(phaseId: string, prev: TaskFormState, form: FormData): Promise<TaskFormState> {
  const values = { title: text(form, 'title'), dueDate: text(form, 'dueDate') };
  if (!isUuid(phaseId)) return { formError: taskFailedAr.unknown_reference, values, added: prev.added };

  const supabase = await createServerSupabase();
  const project = await supabaseProjectGateway(supabase).myProject();
  if (!project) return { formError: taskFailedAr.not_allowed, values, added: prev.added };

  const result = await addTask(supabaseTaskGateway(supabase), project.id, phaseId, values);
  if (!result.ok) {
    if (result.kind === 'invalid') {
      const fieldErrors: TaskFormState['fieldErrors'] = {};
      for (const e of result.errors) fieldErrors[e.field] ??= newTaskErrorsAr[e.code];
      return { fieldErrors, values, added: prev.added };
    }
    return { formError: failureMessage(result), values, added: prev.added };
  }
  revalidatePath(phasePath(phaseId));
  return { added: (prev.added ?? 0) + 1 };
}

/** Bound by the page: one button per task, `setTaskStatusAction.bind(null, phaseId, taskId, nextStatus)`. */
export async function setTaskStatusAction(phaseId: string, taskId: string, status: string): Promise<void> {
  if (!isUuid(taskId)) return;
  await changeTaskStatus(supabaseTaskGateway(await createServerSupabase()), taskId, status);
  // A refused change leaves the task as it was; the page simply shows the stored state again.
  revalidatePath(phasePath(phaseId));
}

export async function deleteTaskAction(phaseId: string, taskId: string): Promise<void> {
  if (!isUuid(taskId)) return;
  await removeTask(supabaseTaskGateway(await createServerSupabase()), taskId);
  revalidatePath(phasePath(phaseId));
}
