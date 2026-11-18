'use client';

// Client pieces of the phase page (FR-PRJ-04): the "new task" form, and the delete button that asks first.

import { useActionState } from 'react';
import type { NewTaskField } from '../domain/tasks';
import { phasePageTextAr as t } from './messages.ar';
import { addTaskAction, deleteTaskAction, type TaskFormState } from './task-actions';
import styles from './wizard.module.css';

const initialState: TaskFormState = {};

export function NewTaskForm({ phaseId }: { phaseId: string }) {
  const [state, formAction, pending] = useActionState(addTaskAction.bind(null, phaseId), initialState);
  const errors = state.fieldErrors ?? {};
  const invalid = (f: NewTaskField) => ({
    'aria-invalid': errors[f] ? (true as const) : undefined,
    'aria-describedby': errors[f] ? `${f}-error` : undefined,
  });

  return (
    // key: a new, empty form after each task added; after an error the typed values come back instead.
    <form action={formAction} noValidate key={`${state.added ?? 0}-${JSON.stringify(state.values ?? {})}`}>
      <p className={styles.groupTitle}>{t.addTitle}</p>
      {state.formError && (
        <p role="alert" className={styles.errorSummary}>
          {state.formError}
        </p>
      )}
      <div className={styles.field}>
        <label htmlFor="title" className={styles.label}>
          {t.taskTitle} <span aria-hidden="true">*</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          autoComplete="off"
          required
          className={styles.input}
          defaultValue={state.values?.title ?? ''}
          {...invalid('title')}
        />
        {errors.title && (
          <p id="title-error" className={styles.fieldError}>
            {errors.title}
          </p>
        )}
      </div>
      <div className={styles.field}>
        <label htmlFor="dueDate" className={styles.label}>
          {t.dueDate}
        </label>
        <input id="dueDate" name="dueDate" type="date" className={styles.input} defaultValue={state.values?.dueDate ?? ''} {...invalid('dueDate')} />
        {errors.dueDate && (
          <p id="dueDate-error" className={styles.fieldError}>
            {errors.dueDate}
          </p>
        )}
      </div>
      <button type="submit" className={styles.secondary} disabled={pending}>
        {pending ? t.adding : t.add}
      </button>
    </form>
  );
}

/** Deleting cannot be undone, so the browser asks first. */
export function DeleteTaskButton({ phaseId, taskId, title }: { phaseId: string; taskId: string; title: string }) {
  return (
    <form
      action={deleteTaskAction.bind(null, phaseId, taskId)}
      onSubmit={(e) => {
        if (!window.confirm(t.deleteConfirm(title))) e.preventDefault();
      }}
    >
      <button type="submit" className={styles.taskButton} aria-label={`${t.delete}: ${title}`}>
        {t.delete}
      </button>
    </form>
  );
}
