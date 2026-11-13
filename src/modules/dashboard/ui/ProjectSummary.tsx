// Project summary shown after the wizard (FR-PRJ-01 "ينقل إلى اللوحة مع خطوة سجّل أول مصروف"; first slice of
// FR-DSH-01, decision 12 of 14 Nov 2026). Server Component: reads under RLS; all money math is done by the finance
// domain (budgetSummary, Decimal) — this file only displays numbers (rule R5).

import type { ReactNode } from 'react';
import { addMoney, formatAmount } from '@/shared-kernel';
import { budgetSummary, getExpensesTotalLyd } from '@/modules/finance';
import type { MyProject } from '@/modules/projects';
import { summaryTextAr as t } from './messages.ar';
import styles from './summary.module.css';

function Row({ title, note, value }: { title: string; note?: string; value: ReactNode }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowText}>
        <strong>{title}</strong>
        {note && <small>{note}</small>}
      </span>
      <span className={styles.rowValue}>{value}</span>
    </div>
  );
}

const dateAr = (iso: string) =>
  new Intl.DateTimeFormat('ar-LY', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Tripoli' }).format(
    new Date(`${iso}T12:00:00Z`),
  );

export async function ProjectSummary({ project, actions }: { project: MyProject; actions?: ReactNode }) {
  const expenses = await getExpensesTotalLyd(project.id);
  // Spent = money spent before the app + recorded expenses (decision 2).
  const summary = budgetSummary(project.totalBudgetLyd, addMoney(project.spentBeforeLyd, expenses), project.contingencyPct);
  const current = project.phases.find((p) => p.status === 'in_progress');
  // <bdi dir="ltr"> keeps the number (and a minus sign such as "-10,000") in the right order inside Arabic text.
  const lyd = (v: Parameters<typeof formatAmount>[0]) => (
    <>
      <bdi dir="ltr">{formatAmount(v)}</bdi> {t.lyd}
    </>
  );

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t.heading}</h1>
        {actions}
      </header>

      <div className={styles.content}>
        <div className={styles.summaryCard}>
          <small>{t.projectName}</small>
          <strong>{project.name}</strong>
          <p>
            {[project.city, project.buildingAreaM2 ? t.area(formatAmount(project.buildingAreaM2)) : null].filter(Boolean).join(' · ')}
          </p>
        </div>

        <div className={styles.list}>
          <Row
            title={t.currentPhase}
            note={current?.name ?? t.noCurrentPhase}
            value={current ? t.phaseOf(current.position, project.phases.length) : '—'}
          />
          <Row title={t.totalBudget} value={lyd(summary.total)} />
          <Row title={t.spent} note={t.spentNote} value={lyd(summary.spent)} />
          <Row title={t.remaining} value={lyd(summary.remaining)} />
          <Row title={t.contingency(formatAmount(project.contingencyPct))} value={lyd(summary.contingency)} />
          {project.availableNowLyd !== null && project.availableAsOf && (
            <Row title={t.available(dateAr(project.availableAsOf))} value={lyd(project.availableNowLyd)} />
          )}
        </div>

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

        <div className={styles.info}>
          <strong>{t.nextStep}</strong>
          {t.nextStepSoon}
        </div>
      </div>
    </main>
  );
}
