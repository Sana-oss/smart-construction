// A phase's stop plan (3.14; FR-DEC-04; design S19.1 «نقاط التوقف الآمنة»). The app never decides where or whether to
// stop: the plan lists what has to be ready if work stops, and the engineer decides (the design's own words, shown on the
// screen). The protection measures take the owner's cost estimates; their sum feeds the stop scenario (3.7).
// Server Component: the total comes from the quality domain (planProtectionCost); this file only displays it (rule R5).

import Link from 'next/link';
import { formatAmount } from '@/shared-kernel';
import type { StopPlanView } from '../application/checklists';
import { createStopPlanAction } from './checklist-actions';
import { BackIcon } from './icons';
import { checklistTextAr, stopPlanTextAr as t } from './messages.ar';
import { checkItemPath } from './routes';
import styles from './quality.module.css';

interface Props {
  phase: { id: string; name: string };
  view: StopPlanView;
  backHref: string;
  /** Where the owner enters the scenario figures (the decisions module's form). */
  scenarioHref: string;
  notice?: 'saved' | null;
}

export function StopPlanScreen({ phase, view, backHref, scenarioHref, notice = null }: Props) {
  const { detail, protectionCost } = view;
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={backHref} className={styles.iconButton} aria-label={checklistTextAr.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.subtitle}>{t.subtitle(phase.name)}</p>
        </div>
      </header>

      <div className={styles.scroll}>
        {notice === 'saved' && (
          <p role="status" className={styles.info}>
            {t.saved}
          </p>
        )}
        <p className={styles.errorSummary}>{t.engineerDecides}</p>
        {!detail ? (
          <div className={styles.empty}>
            <strong>{t.empty}</strong>
            <p>{t.emptyNote}</p>
          </div>
        ) : (
          <>
            {detail.checklist.templateStatus === 'unreviewed' && (
              <p className={styles.hint}>
                <span className={styles.tag}>{checklistTextAr.unreviewed}</span>
              </p>
            )}
            <div className={styles.summaryCard}>
              <small>{t.protectionTotal}</small>
              <strong>{protectionCost ? t.costOf(formatAmount(protectionCost)) : t.protectionNone}</strong>
              <p>{t.protectionNote}</p>
            </div>
            <p className={styles.hint}>{t.progress(detail.progress.checked, detail.progress.total)}</p>
            <ul className={styles.list} aria-label={t.title}>
              {detail.items.map((item) => (
                <li key={item.id} className={styles.listRow}>
                  <Link
                    href={checkItemPath(detail.checklist.id, item.id)}
                    className={`${styles.rowText} ${styles.rowLink}`}
                    aria-label={checklistTextAr.list.open(item.text)}
                  >
                    <strong>{item.text}</strong>
                    <small>{[item.costLyd ? t.costOf(formatAmount(item.costLyd)) : null, item.note].filter(Boolean).join(' · ') || ' '}</small>
                  </Link>
                  <span className={styles.rowValue}>{checklistTextAr.stopPlanResult[item.result ?? 'none']}</span>
                </li>
              ))}
            </ul>
            <Link href={scenarioHref} className={styles.quickLink}>
              <span className={styles.rowText}>
                <strong>{t.toScenario}</strong>
              </span>
            </Link>
          </>
        )}
        <p className={styles.hint}>{t.disclaimer}</p>
      </div>

      {!detail && (
        <div className={styles.actions}>
          <form action={createStopPlanAction.bind(null, phase.id)}>
            <button type="submit" className={styles.primary}>
              {t.create}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
