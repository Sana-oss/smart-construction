// The owner's reference exchange rates (3.18; decision of 20 Nov 2026). No design screen: built from the design's list
// and card styles. Server Component: the order and the latest of each currency come from the domain.

import Link from 'next/link';
import type { RateLog as RateLogData } from '../application/rates';
import { CURRENCIES } from '../domain/currency';
import { DeleteRateButton } from './DeleteRateButton';
import { BackIcon } from './icons';
import { currencyTextAr, expenseTextAr } from './messages.ar';
import { RATE_NEW_PATH } from './routes';
import styles from './expense.module.css';

const t = currencyTextAr.log;
const fullDateAr = (iso: string) =>
  new Intl.DateTimeFormat('ar-LY', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Tripoli' }).format(
    new Date(`${iso}T12:00:00Z`),
  );
const plain = (r: string) => r.replace(/\.?0+$/, '');

interface Props {
  log: RateLogData;
  backHref: string;
  notice?: 'added' | 'deleted' | null;
}

export function RateLog({ log, backHref, notice = null }: Props) {
  const latest = CURRENCIES.filter((c) => log.latest[c]);
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={backHref} className={styles.iconButton} aria-label={expenseTextAr.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.subtitle}>{t.subtitle}</p>
        </div>
      </header>

      <div className={styles.scroll}>
        {notice && (
          <p role="status" className={styles.info}>
            {notice === 'added' ? t.added : t.deleted}
          </p>
        )}

        {log.rates.length === 0 ? (
          <div className={styles.empty}>
            <strong>{t.empty}</strong>
            <p>{t.emptyNote}</p>
          </div>
        ) : (
          <>
            <ul className={styles.list} aria-label={t.latestTitle}>
              {latest.map((code) => {
                const r = log.latest[code]!;
                return (
                  <li key={code} className={styles.listRow}>
                    <span className={styles.rowText}>
                      <strong>
                        {currencyTextAr.names[code]} ({code})
                      </strong>
                      <small>{fullDateAr(r.rateDate)}</small>
                    </span>
                    <span className={styles.rowValue}>
                      <bdi dir="ltr">{plain(r.lydPerUnit)}</bdi> <small>{t.perUnit(code)}</small>
                    </span>
                  </li>
                );
              })}
            </ul>

            <p className={styles.label}>{t.history}</p>
            <ul className={styles.list} aria-label={t.history}>
              {log.rates.map((r) => (
                <li key={r.id} className={styles.listRow}>
                  <span className={styles.rowText}>
                    <strong>
                      {r.currency} · {fullDateAr(r.rateDate)}
                    </strong>
                    {r.note && <small>{r.note}</small>}
                  </span>
                  <span className={styles.rowValue}>
                    <bdi dir="ltr">{plain(r.lydPerUnit)}</bdi> {expenseTextAr.lyd}
                    <DeleteRateButton id={r.id} currency={r.currency} date={fullDateAr(r.rateDate)} />
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        <p role="note" className={styles.hint}>
          {t.notice}
        </p>
      </div>

      <div className={styles.actions}>
        <Link href={RATE_NEW_PATH} className={styles.primary}>
          {t.add}
        </Link>
      </div>
    </main>
  );
}
