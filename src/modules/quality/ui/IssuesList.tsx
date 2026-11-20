// The defects list (design S28.1 «سجل العيوب»; FR-QLT-06, FR-QLT-07): unresolved first, then the higher priority, then
// the newest (the quality domain's order, sortIssues; this file only displays it, rule R5).

import Link from 'next/link';
import type { IssueList } from '../application/issues';
import { BackIcon } from './icons';
import { issueTextAr as t } from './messages.ar';
import { issuePath, newIssuePath } from './routes';
import styles from './quality.module.css';

const dayMonthAr = (iso: string) =>
  new Intl.DateTimeFormat('ar-LY', { day: 'numeric', month: 'long', timeZone: 'Africa/Tripoli' }).format(new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso));

interface Props {
  list: IssueList;
  /** The phase the list is filtered to, or null for the whole project. */
  phase: { id: string; name: string } | null;
  backHref: string;
}

export function IssuesList({ list, phase, backHref }: Props) {
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={backHref} className={styles.iconButton} aria-label={t.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{t.list.title}</h1>
          <p className={styles.subtitle}>{phase ? t.list.subtitlePhase(phase.name, list.openCount) : t.list.subtitleAll(list.openCount)}</p>
        </div>
      </header>

      <div className={styles.scroll}>
        {list.issues.length === 0 ? (
          <div className={styles.empty}>
            <strong>{t.list.empty}</strong>
            <p>{t.list.emptyNote}</p>
          </div>
        ) : (
          <ul className={styles.list} aria-label={t.list.title}>
            {list.issues.map((i) => (
              <li key={i.id} className={styles.listRow}>
                <Link href={issuePath(i.id)} className={`${styles.rowText} ${styles.rowLink}`} aria-label={t.list.open(i.title)}>
                  <strong>{i.title}</strong>
                  <small>{t.list.row(t.status[i.status], i.responsible, dayMonthAr(i.createdAt))}</small>
                </Link>
                <span className={styles.rowValue}>{t.severity[i.severity]}</span>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.hint}>{t.list.priorityNote}</p>
      </div>

      <div className={styles.actions}>
        <Link href={newIssuePath({ phaseId: phase?.id })} className={styles.primary}>
          {t.list.add}
        </Link>
      </div>
    </main>
  );
}
