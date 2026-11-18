// One phase: its progress and tasks (FR-PRJ-04). Design: S10.1 (overview) and S10.2 «مهام المرحلة», merged into one
// screen because S10.1's other rows (checklist, concrete log, trade packs, safe stopping points) are not built yet.
// Server Component: progress and "overdue" come from the domain (phaseProgress, isTaskOverdue); this file only
// displays them (R5). Not built (change register): the task's person in charge (no team accounts), and the
// design's status «بانتظار الفحص» (the table has todo/doing/done).

import Link from 'next/link';
import type { ProjectPhase } from '../application/project-gateway';
import type { PhaseTask } from '../application/tasks';
import { phaseDelay } from '../domain/phase-schedule';
import { isTaskOverdue, nextTaskStatus, phaseProgress } from '../domain/tasks';
import { BackIcon } from './icons';
import { daysAr, phasePageTextAr as t, phasesTextAr, phaseStatusAr, taskActionAr, tasksCountAr, taskStatusAr } from './messages.ar';
import { phaseSchedulePath } from './routes';
import { setTaskStatusAction } from './task-actions';
import { DeleteTaskButton, NewTaskForm } from './TaskForms';
import styles from './wizard.module.css';

interface Props {
  phase: ProjectPhase;
  tasks: PhaseTask[];
  /** The date in Libya, "YYYY-MM-DD". */
  today: string;
  backHref: string;
  /**
   * More rows under «الحالة والتواريخ», from modules this one may not import (for example the phase's documents,
   * S10.4): the page builds them. Each opens another screen.
   */
  links?: { label: string; note: string; href: string }[];
}

/** "2026-11-09" -> "9 نوفمبر 2026". Noon UTC keeps the day the same in every time zone. */
const dateAr = (iso: string) =>
  new Intl.DateTimeFormat('ar-LY', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Tripoli' }).format(
    new Date(`${iso}T12:00:00Z`),
  );

export function PhaseDetail({ phase, tasks, today, backHref, links = [] }: Props) {
  const progress = phaseProgress(tasks);
  const delay = phaseDelay(phase, today);
  const delayText =
    delay.kind === 'late'
      ? delay.ongoing
        ? phasesTextAr.delay.lateNow(daysAr(delay.days))
        : phasesTextAr.delay.lateDone(daysAr(delay.days))
      : delay.kind === 'early'
        ? phasesTextAr.delay.early(daysAr(delay.days))
        : delay.kind === 'on_time'
          ? phasesTextAr.delay.onTime
          : null;

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={backHref} className={styles.iconButton} aria-label={t.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{phase.name}</h1>
          <p className={styles.subtitle}>{t.subtitle}</p>
        </div>
      </header>

      <div className={styles.scroll}>
        <div className={styles.summaryCard}>
          <small>{t.progressCard}</small>
          <strong>{progress.percent === null ? '—' : `${progress.percent}%`}</strong>
          <p>{progress.total === 0 ? t.noTasks : t.progressOf(progress.done, tasksCountAr(progress.total))}</p>
        </div>

        <div className={styles.list}>
          <Link href={phaseSchedulePath(phase.id)} className={`${styles.listRow} ${styles.rowLink}`}>
            <span className={styles.rowText}>
              <strong>{t.scheduleRow}</strong>
              <small>{[phaseStatusAr[phase.status], delayText].filter(Boolean).join(' · ')}</small>
            </span>
          </Link>
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={`${styles.listRow} ${styles.rowLink} ${styles.rowDivider}`}>
              <span className={styles.rowText}>
                <strong>{l.label}</strong>
                <small>{l.note}</small>
              </span>
            </Link>
          ))}
        </div>

        <section aria-labelledby="tasks-title">
          <p id="tasks-title" className={styles.groupTitle}>
            {t.tasksTitle}
          </p>
          {tasks.length > 0 && (
            <ul className={styles.list} aria-labelledby="tasks-title">
              {tasks.map((task) => {
                const overdue = isTaskOverdue(task, today);
                const meta = [taskStatusAr[task.status], task.dueDate ? t.due(dateAr(task.dueDate)) : null, overdue ? t.overdue : null];
                return (
                  <li key={task.id} className={styles.listRow}>
                    <span className={styles.rowText}>
                      <strong>{task.title}</strong>
                      <small>{meta.filter(Boolean).join(' · ')}</small>
                    </span>
                    <span className={styles.taskActions}>
                      <form action={setTaskStatusAction.bind(null, phase.id, task.id, nextTaskStatus(task.status))}>
                        <button type="submit" className={styles.taskButton} aria-label={`${taskActionAr[task.status]}: ${task.title}`}>
                          {taskActionAr[task.status]}
                        </button>
                      </form>
                      <DeleteTaskButton phaseId={phase.id} taskId={task.id} title={task.title} />
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <NewTaskForm phaseId={phase.id} />
      </div>
    </main>
  );
}
