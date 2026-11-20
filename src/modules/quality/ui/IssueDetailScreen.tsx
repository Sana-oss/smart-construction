// Following one defect (design S28.3 «متابعة العيب»; FR-QLT-06): its state and the dates of each state (set by the
// database, 0029), who fixes it, where, and its photo; buttons to move it on, to close it (after the engineer's review,
// as advice: there are no engineer accounts) or to reopen it. Server Component.

import Link from 'next/link';
import type { IssueRecord } from '../application/issues';
import { IssuePhotoForm } from './IssuePhotoForm';
import { IssueStatusButton } from './IssueStatusButton';
import { BackIcon } from './icons';
import { issueTextAr as t } from './messages.ar';
import styles from './quality.module.css';

const dateAr = (iso: string) =>
  new Intl.DateTimeFormat('ar-LY', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Tripoli' }).format(
    new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso),
  );

interface Props {
  issue: IssueRecord;
  photoUrl: string | null;
  phaseName: string | null;
  backHref: string;
  notice?: 'added' | 'changed' | null;
}

export function IssueDetailScreen({ issue, photoUrl, phaseName, backHref, notice = null }: Props) {
  const d = t.detail;
  const row = (title: string, value: string | null) =>
    value && (
      <li className={styles.listRow}>
        <span className={styles.rowText}>
          <strong>{title}</strong>
          <small>{value}</small>
        </span>
      </li>
    );
  const step = (label: string, at: string | null) => (
    <li className={styles.listRow}>
      <span className={styles.rowText}>
        <strong>{label}</strong>
        <small>{at ? dateAr(at) : '—'}</small>
      </span>
    </li>
  );

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={backHref} className={styles.iconButton} aria-label={t.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{issue.title}</h1>
          <p className={styles.subtitle}>
            {d.title} · {t.severity[issue.severity]}
          </p>
        </div>
      </header>

      <div className={styles.scroll}>
        {notice && (
          <p role="status" className={styles.info}>
            {notice === 'added' ? t.list.added : d.changed}
          </p>
        )}
        <div className={styles.summaryCard}>
          <small>{d.statusLabel}</small>
          <strong>{t.status[issue.status]}</strong>
          {issue.responsible && <p>{d.responsible(issue.responsible)}</p>}
        </div>

        <ul className={styles.list} aria-label={d.title}>
          {row(d.phase, phaseName)}
          {row(d.location, issue.location)}
          {row(d.description, issue.description)}
          {row(d.due, issue.dueOn ? dateAr(issue.dueOn) : null)}
        </ul>

        <section aria-labelledby="timeline-title">
          <h2 id="timeline-title" className={styles.label}>
            {d.timeline}
          </h2>
          <ul className={styles.list} aria-label={d.timeline}>
            {step(d.created, issue.createdAt)}
            {step(d.started, issue.startedAt)}
            {step(d.closed, issue.closedAt)}
          </ul>
        </section>

        <IssuePhotoForm issueId={issue.id} photoUrl={photoUrl} />

        <div className={styles.quickLinks}>
          {issue.status === 'open' && <IssueStatusButton id={issue.id} status="in_progress" label={d.toInProgress} />}
          {issue.status !== 'closed' && <IssueStatusButton id={issue.id} status="closed" label={d.toClosed} confirm={d.closeConfirm} />}
          {issue.status === 'closed' && <IssueStatusButton id={issue.id} status="open" label={d.reopen} confirm={d.reopenConfirm} />}
        </div>
        <p className={styles.hint}>{d.engineerAdvice}</p>
      </div>

      <div className={styles.actions}>
        <Link href={backHref} className={styles.secondary}>
          {d.backToList}
        </Link>
      </div>
    </main>
  );
}
