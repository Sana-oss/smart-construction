// Project budget (design S15.1 «ميزانية المشروع»): the hub of the budget screens. Server Component: every number comes
// from the finance domain (budgetSummary, budgetPlan); this file only displays them (rule R5).
// The design's «العقود والدفعات» row shows «قريبًا»: contracts are priority 2 (FR-FIN-08) and not built.

import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatAmount } from '@/shared-kernel';
import type { BudgetView } from '../application/budget-plan';
import type { ContingencyUse } from '../domain/extras';
import { BackIcon } from './icons';
import { budgetTextAr } from './messages.ar';
import styles from './expense.module.css';

const t = budgetTextAr.overview;

interface Props {
  view: BudgetView;
  /** FR-FIN-10: approved extra works, taken from the contingency first. */
  extras: ContingencyUse;
  backHref: string;
  links: { phases: string; extras: string; cashflow: string; decision: string };
}

function Row({ href, title, note, action }: { href?: string; title: string; note: string; action: ReactNode }) {
  const body = (
    <>
      <span className={styles.rowText}>
        <strong>{title}</strong>
        <small>{note}</small>
      </span>
      <span className={styles.rowValue}>{action}</span>
    </>
  );
  return href ? (
    <Link href={href} className={`${styles.listRow} ${styles.rowLink}`}>
      {body}
    </Link>
  ) : (
    <div className={styles.listRow} aria-disabled="true">
      {body}
    </div>
  );
}

export function BudgetOverview({ view, extras, backHref, links }: Props) {
  const { summary, plan } = view;
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={backHref} className={styles.iconButton} aria-label={budgetTextAr.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.subtitle}>{t.subtitle}</p>
        </div>
      </header>

      <div className={styles.scroll}>
        {/* Design S15.1 summary */}
        <div className={styles.summaryCard}>
          <small>{t.remaining}</small>
          <strong>
            <bdi dir="ltr">{formatAmount(summary.remaining)}</bdi> {budgetTextAr.lyd}
          </strong>
          <p>{t.approvedSpent(formatAmount(summary.total), formatAmount(summary.spent))}</p>
        </div>

        {summary.overBudget && (
          <p role="status" className={styles.errorSummary}>
            {t.overBudget}
          </p>
        )}
        {extras.usedUp && (
          <p role="status" className={styles.errorSummary}>
            {t.contingencyUsedUp}{' '}
            {extras.beyondContingency.gt(0) && t.beyondBudget(formatAmount(extras.expectedTotal), formatAmount(extras.beyondContingency))}
          </p>
        )}
        {plan.overPhases > 0 && (
          <p role="status" className={styles.errorSummary}>
            <Link href={links.phases}>{t.overPhases(plan.overPhases)}</Link>
          </p>
        )}

        <nav className={styles.list} aria-label={t.title}>
          <Row href={links.phases} title={t.rows.phases.title} note={t.rows.phases.note} action={t.rows.phases.action} />
          <Row
            href={links.extras}
            title={t.rows.extras.title}
            note={t.rows.extras.note(formatAmount(extras.approved), formatAmount(extras.proposed))}
            action={t.rows.extras.action}
          />
          <Row href={links.cashflow} title={t.rows.cashflow.title} note={t.rows.cashflow.note} action={t.rows.cashflow.action} />
          <Row title={t.rows.contracts.title} note={t.rows.contracts.note} action={t.rows.contracts.action} />
          <Row href={links.decision} title={t.rows.decision.title} note={t.rows.decision.note} action={t.rows.decision.action} />
        </nav>
      </div>
    </main>
  );
}
