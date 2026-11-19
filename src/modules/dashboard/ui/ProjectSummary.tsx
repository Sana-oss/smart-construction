// Project dashboard (FR-DSH-01, FR-DSH-02). Design: S07.1 «لوحة المشروع». Server Component: reads under RLS; every
// number comes from a domain (finance: budgetSummary/totalSpent; projects: overallProgress; dashboard: nextStep);
// this file only displays them (rule R5).
// Differences from the design (change register, 19 Nov): a «المتبقي من الميزانية» row is added, because FR-DSH-01
// asks for the remaining budget and the contingency on the dashboard; «المواد والكميات» shows «قريبًا» until the
// materials feature exists; «المزيد» lists documents, photos and the account (team and reports are not built).

import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatAmount, money } from '@/shared-kernel';
import { budgetSummary, EXPENSE_NEW_PATH, EXPENSES_PATH, totalSpent } from '@/modules/finance';
import {
  currentPhaseOf,
  overallProgress,
  phasePath,
  phaseSchedulePath,
  PHASES_PATH,
  type MyProject,
  type PhaseTask,
} from '@/modules/projects';
import { nextStep, type NextStep } from '../domain/next-step';
import { summaryTextAr as t } from './messages.ar';
import { getRecordedExpensesLyd } from './queries';
import styles from './summary.module.css';

const dateAr = (iso: string) =>
  new Intl.DateTimeFormat('ar-LY', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Tripoli' }).format(
    new Date(`${iso}T12:00:00Z`),
  );

/** <bdi dir="ltr"> keeps the number (and a minus sign such as "-10,000") in the right order inside Arabic text. */
const Amount = ({ value }: { value: Parameters<typeof formatAmount>[0] }) => <bdi dir="ltr">{formatAmount(value)}</bdi>;

function Row({ href, title, note, value }: { href?: string; title: string; note?: ReactNode; value: ReactNode }) {
  const body = (
    <>
      <span className={styles.rowText}>
        <strong>{title}</strong>
        {note && <small>{note}</small>}
      </span>
      <span className={styles.rowValue}>{value}</span>
    </>
  );
  return href ? (
    <Link href={href} className={`${styles.row} ${styles.rowLink}`}>
      {body}
    </Link>
  ) : (
    <div className={styles.row}>{body}</div>
  );
}

function nextStepRow(step: NextStep): { note: string; action: string; href: string } {
  switch (step.kind) {
    case 'first_expense':
      return { ...t.next.first_expense, href: EXPENSE_NEW_PATH };
    case 'daily_expense':
      return { ...t.next.daily_expense, href: EXPENSE_NEW_PATH };
    case 'late_phase':
      return { note: t.next.late_phase.note(step.phaseName), action: t.next.late_phase.action, href: phasePath(step.phaseId) };
    case 'overdue_task':
      return {
        note: t.next.overdue_task.note(step.taskTitle),
        action: t.next.overdue_task.action,
        href: step.phaseId ? phasePath(step.phaseId) : PHASES_PATH,
      };
    case 'set_dates':
      return { note: t.next.set_dates.note(step.phaseName), action: t.next.set_dates.action, href: phaseSchedulePath(step.phaseId) };
  }
}

interface Props {
  project: MyProject;
  tasks: PhaseTask[];
  /** The date in Libya, "YYYY-MM-DD". */
  today: string;
  firstName: string | null;
  /** «المزيد» lives in the app layer (it gathers several modules), so the page passes its address. */
  moreHref: string;
}

export async function ProjectSummary({ project, tasks, today, firstName, moreHref }: Props) {
  const expenses = await getRecordedExpensesLyd(project.id);
  // Spent = money spent before the app + recorded expenses (decision 2); the sum is done by the finance domain.
  const summary = budgetSummary(project.totalBudgetLyd, totalSpent(project.spentBeforeLyd, expenses), project.contingencyPct);
  const current = currentPhaseOf(project.phases);
  const progress = overallProgress(project.phases, tasks);
  // A comparison, not a calculation (R5): money spent before the app was never recorded here.
  const step = nextStepRow(nextStep({ expensesRecorded: money(expenses).gt(0), phases: project.phases, tasks, today }));

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t.heading}</h1>
          <p className={styles.subtitle}>{t.subtitle(project.name, firstName)}</p>
        </div>
      </header>

      <div className={styles.content}>
        <div className={styles.summaryCard}>
          <small>{t.progress}</small>
          <strong>{progress === null ? t.noProgress : `${progress}%`}</strong>
          <p>{current ? t.currentPhase(current.name) : t.noCurrentPhase}</p>
        </div>

        <nav className={styles.list} aria-label={t.heading}>
          <Row href={step.href} title={t.nextStep} note={step.note} value={step.action} />
          <Row
            href={EXPENSES_PATH}
            title={t.expenses}
            note={t.expensesNote(formatAmount(summary.total))}
            value={
              <>
                <Amount value={summary.spent} /> {t.lyd}
              </>
            }
          />
          <Row
            title={t.budget}
            note={
              <>
                {t.budgetNote(formatAmount(summary.contingency), formatAmount(project.contingencyPct))}
                {project.availableNowLyd !== null && project.availableAsOf && (
                  <>
                    <br />
                    {t.availableNote(formatAmount(project.availableNowLyd), dateAr(project.availableAsOf))}
                  </>
                )}
              </>
            }
            value={
              <>
                <Amount value={summary.remaining} /> {t.lyd}
              </>
            }
          />
          <Row
            href={PHASES_PATH}
            title={t.phases}
            note={t.phasesNote}
            value={current ? t.phaseOf(current.position, project.phases.length) : '—'}
          />
          <div className={`${styles.row} ${styles.disabled}`} aria-disabled="true">
            <span className={styles.rowText}>
              <strong>{t.materials}</strong>
              <small>{t.materialsNote}</small>
            </span>
            <span className={styles.rowValue}>{t.soon}</span>
          </div>
          <Row href={moreHref} title={t.more} note={t.moreNote} value={t.open} />
        </nav>

        {summary.overBudget && (
          <p role="status" className={styles.warning}>
            {t.overBudget}
          </p>
        )}
        {project.projectType === 'add_floor' && (
          <p role="note" className={styles.warning}>
            {t.addFloorWarning}
          </p>
        )}

        {/* Design S07.1: the quick-expense button. */}
        <Link href={EXPENSE_NEW_PATH} className={styles.primary}>
          {t.addExpense}
        </Link>
      </div>
    </main>
  );
}
