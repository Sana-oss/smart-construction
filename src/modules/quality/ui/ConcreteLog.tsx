// The concrete log (design S27.1 «سجل الخرسانة»; FR-QLT-04, FR-QLT-05): the total quantity, the due reminders on the
// engineer's dates, and the pours, newest first. Server Component: the totals and reminders come from the quality
// domain (pourTotals, dueReminders); this file only displays them (rule R5).

import Link from 'next/link';
import { formatAmount } from '@/shared-kernel';
import type { ConcreteLog as Log } from '../application/concrete';
import { BackIcon } from './icons';
import { concreteTextAr as t } from './messages.ar';
import { newPourPath, pourPath } from './routes';
import styles from './quality.module.css';

const dayMonthAr = (iso: string) =>
  new Intl.DateTimeFormat('ar-LY', { day: 'numeric', month: 'long', timeZone: 'Africa/Tripoli' }).format(new Date(`${iso}T12:00:00Z`));

interface Props {
  log: Log;
  phase: { id: string; name: string } | null;
  backHref: string;
  notice?: 'deleted' | null;
}

export function ConcreteLog({ log, phase, backHref, notice = null }: Props) {
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={backHref} className={styles.iconButton} aria-label={t.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{t.log.title}</h1>
          <p className={styles.subtitle}>{phase ? t.log.subtitlePhase(phase.name) : t.log.subtitleAll}</p>
        </div>
      </header>

      <div className={styles.scroll}>
        {notice === 'deleted' && (
          <p role="status" className={styles.info}>
            {t.log.deleted}
          </p>
        )}
        <div className={styles.summaryCard}>
          <small>{t.log.total}</small>
          <strong>
            <bdi dir="ltr">{formatAmount(log.totalM3)}</bdi> {t.m3}
          </strong>
          <p>{t.log.count(log.count)}</p>
        </div>

        {log.reminders.length > 0 && (
          <section aria-labelledby="reminders-title">
            <h2 id="reminders-title" className={styles.label}>
              {t.log.reminders}
            </h2>
            <ul className={styles.list} aria-label={t.log.reminders}>
              {log.reminders.map((r) => (
                <li key={`${r.pourId}-${r.kind}`} className={styles.listRow}>
                  <Link href={pourPath(r.pourId)} className={`${styles.rowText} ${styles.rowLink}`}>
                    <strong>{r.kind === 'curing' ? t.reminder.curing(r.element) : t.reminder.formwork(r.element)}</strong>
                    <small>{dayMonthAr(r.date)}</small>
                  </Link>
                  <span className={styles.rowValue}>{t.reminder.when(r.days)}</span>
                </li>
              ))}
            </ul>
            <p className={styles.hint}>{t.reminder.note}</p>
          </section>
        )}

        {log.pours.length === 0 ? (
          <div className={styles.empty}>
            <strong>{t.log.empty}</strong>
            <p>{t.log.emptyNote}</p>
          </div>
        ) : (
          <ul className={styles.list} aria-label={t.log.title}>
            {log.pours.map((p) => (
              <li key={p.id} className={styles.listRow}>
                <Link href={pourPath(p.id)} className={`${styles.rowText} ${styles.rowLink}`} aria-label={t.log.open(p.element)}>
                  <strong>{p.element}</strong>
                  <small>{t.log.row(dayMonthAr(p.pouredOn), p.supplier)}</small>
                </Link>
                <span className={styles.rowValue}>
                  <bdi dir="ltr">{formatAmount(p.qtyM3)}</bdi> {t.m3}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.actions}>
        <Link href={newPourPath(phase?.id)} className={styles.primary}>
          {t.log.add}
        </Link>
      </div>
    </main>
  );
}
