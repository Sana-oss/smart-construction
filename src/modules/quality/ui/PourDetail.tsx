// One pour, with its two reminders (FR-QLT-04, FR-QLT-05): the engineer's dates as the owner copied them, «تمّ» (stamped
// by the database) or undoing it, and deleting the pour (the audit log keeps it). Server Component.

import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatAmount } from '@/shared-kernel';
import type { PourRecord } from '../application/concrete';
import { ConfirmFormButton } from './ConfirmFormButton';
import { deletePourAction, markReminderAction } from './concrete-actions';
import { BackIcon } from './icons';
import { concreteTextAr as t } from './messages.ar';
import styles from './quality.module.css';

const dateAr = (iso: string) =>
  new Intl.DateTimeFormat('ar-LY', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Tripoli' }).format(
    new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso),
  );

interface Props {
  pour: PourRecord;
  phaseName: string | null;
  backHref: string;
  notice?: 'added' | 'changed' | null;
}

export function PourDetail({ pour, phaseName, backHref, notice = null }: Props) {
  const d = t.detail;
  const row = (title: string, value: ReactNode) =>
    value !== null && value !== '' && (
      <li className={styles.listRow}>
        <span className={styles.rowText}>
          <strong>{title}</strong>
          <small>{value}</small>
        </span>
      </li>
    );
  const reminder = (kind: 'curing' | 'formwork', label: string, date: string | null, doneAt: string | null) => (
    <li className={styles.listRow}>
      <span className={styles.rowText}>
        <strong>{label}</strong>
        <small>{date ? dateAr(date) : d.noDate}</small>
      </span>
      {date && (
        <span className={styles.rowValue}>
          {doneAt ? d.doneAt(dateAr(doneAt)) : null}
          <ConfirmFormButton action={markReminderAction.bind(null, pour.id, kind, !doneAt)} label={doneAt ? d.undo : d.done} ariaLabel={`${doneAt ? d.undo : d.done}: ${label}`} />
        </span>
      )}
    </li>
  );

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={backHref} className={styles.iconButton} aria-label={t.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{pour.element}</h1>
          <p className={styles.subtitle}>{d.pageTitle}</p>
        </div>
      </header>

      <div className={styles.scroll}>
        {notice && (
          <p role="status" className={styles.info}>
            {notice === 'added' ? t.log.added : d.changed}
          </p>
        )}
        <ul className={styles.list} aria-label={d.pageTitle}>
          {row(d.pouredOn, dateAr(pour.pouredOn))}
          {row(d.supplier, pour.supplier)}
          {row(
            d.qty,
            <>
              <bdi dir="ltr">{formatAmount(pour.qtyM3)}</bdi> {t.m3}
            </>,
          )}
          {row(d.cubes, String(pour.cubeSamples))}
          {row(d.mixRef, pour.mixRef)}
          {row(d.deliveryRef, pour.deliveryRef)}
          {row(d.phase, phaseName)}
          {row(d.note, pour.note)}
        </ul>

        <section aria-labelledby="engineer-dates">
          <h2 id="engineer-dates" className={styles.label}>
            {t.form.engineerGroup}
          </h2>
          <ul className={styles.list} aria-label={t.form.engineerGroup}>
            {reminder('curing', d.curing, pour.curingUntil, pour.curingDoneAt)}
            {reminder('formwork', d.formwork, pour.formworkOn, pour.formworkDoneAt)}
          </ul>
          <p className={styles.hint}>{t.reminder.note}</p>
        </section>

        <ConfirmFormButton action={deletePourAction.bind(null, pour.id, pour.phaseId)} label={d.delete} confirm={d.deleteConfirm} />
      </div>

      <div className={styles.actions}>
        <Link href={backHref} className={styles.secondary}>
          {t.log.title}
        </Link>
      </div>
    </main>
  );
}
