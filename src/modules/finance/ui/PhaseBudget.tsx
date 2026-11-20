// Budget per phase (design S15.2 «توزيع الميزانية»; FR-FIN-11). Server Component: the allocations, the spending and the
// warnings come from the finance domain (budgetPlan); this file only displays them (rule R5).
// Besides the design's rows (each phase, and «احتياطي المشروع»), two rows keep the totals honest: expenses recorded
// without a phase, and the money spent before the app (which no phase can claim).

import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatAmount, money, type Money } from '@/shared-kernel';
import type { BudgetView } from '../application/budget-plan';
import type { ContingencyUse } from '../domain/extras';
import { BackIcon } from './icons';
import { budgetTextAr } from './messages.ar';
import styles from './expense.module.css';

const t = budgetTextAr.phases;
const Lyd = ({ value }: { value: Money | string }) => (
  <>
    <bdi dir="ltr">{formatAmount(value)}</bdi> {budgetTextAr.lyd}
  </>
);

interface Props {
  view: BudgetView;
  /** FR-FIN-10: how much of the contingency the approved extra works use. */
  extras: ContingencyUse;
  /** Phase names and statuses come from the projects module (the page passes them in). */
  phases: { id: string; name: string; status: string }[];
  spentBeforeLyd: string;
  backHref: string;
  editHref: string;
  notice?: 'saved' | null;
}

function Row({ title, note, value, warn = false }: { title: string; note: ReactNode; value: ReactNode; warn?: boolean }) {
  return (
    <li className={styles.listRow} data-over={warn || undefined}>
      <span className={styles.rowText}>
        <strong>{title}</strong>
        <small>{note}</small>
      </span>
      <span className={styles.rowValue}>{value}</span>
    </li>
  );
}

export function PhaseBudget({ view, extras, phases, spentBeforeLyd, backHref, editHref, notice = null }: Props) {
  const { plan, summary } = view;
  const nameOf = (id: string) => phases.find((p) => p.id === id);
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
        {notice === 'saved' && (
          <p role="status" className={styles.info}>
            {t.saved}
          </p>
        )}
        <p className={styles.hint}>{t.allocated(formatAmount(plan.allocatedTotal), formatAmount(plan.forPhases))}</p>
        {plan.overAllocated && (
          <p role="status" className={styles.errorSummary}>
            {t.overAllocated}
          </p>
        )}

        <ul className={styles.list} aria-label={t.title}>
          {plan.rows.map((r) => {
            const phase = nameOf(r.phaseId);
            const started = r.spent.gt(0) || (phase && phase.status !== 'not_started');
            const note = (
              <>
                {started ? t.spent(formatAmount(r.spent)) : t.notStarted}
                {r.usedPct !== null && started && ` · ${t.usedPct(r.usedPct)}`}
                {r.over && (
                  <>
                    <br />
                    <strong>{t.over}</strong>
                  </>
                )}
              </>
            );
            return (
              <Row
                key={r.phaseId}
                title={phase?.name ?? ''}
                note={note}
                value={r.allocated !== null ? <Lyd value={r.allocated} /> : t.noAllocation}
                warn={r.over}
              />
            );
          })}
          <Row
            title={t.contingency}
            note={extras.approved.gt(0) ? t.contingencyUsed(formatAmount(extras.approved), formatAmount(extras.contingencyLeft)) : t.contingencyNote}
            value={<Lyd value={summary.contingency} />}
            warn={extras.usedUp}
          />
          {plan.unassigned.gt(0) && <Row title={t.unassigned} note={t.unassignedNote} value={<Lyd value={plan.unassigned} />} />}
          {!money(spentBeforeLyd).isZero() && <Row title={t.before} note={t.beforeNote} value={<Lyd value={spentBeforeLyd} />} />}
        </ul>
        <p className={styles.hint}>{t.deviationNote}</p>
      </div>

      <div className={styles.actions}>
        <Link href={editHref} className={styles.primary}>
          {t.edit}
        </Link>
        <Link href={backHref} className={styles.secondary}>
          {t.backToBudget}
        </Link>
      </div>
    </main>
  );
}
