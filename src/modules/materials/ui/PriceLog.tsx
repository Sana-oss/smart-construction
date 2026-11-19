// Price log (design S24.1 «سجل الأسعار»; FR-MAT-08, FR-MAT-10). Server Component: one row per material and unit with
// its latest price, from the domain (latestPrices); this file only displays it (rule R5).

import Link from 'next/link';
import { formatAmount } from '@/shared-kernel';
import type { PriceLog as PriceLogData } from '../application/prices';
import { BackIcon } from './icons';
import { priceTextAr } from './messages.ar';
import { PRICE_NEW_PATH, priceHistoryPath } from './routes';
import { StatusTag } from './StatusTag';
import styles from './materials.module.css';

const t = priceTextAr.log;
const dayMonthAr = (iso: string) =>
  new Intl.DateTimeFormat('ar-LY', { day: 'numeric', month: 'long', timeZone: 'Africa/Tripoli' }).format(new Date(`${iso}T12:00:00Z`));

interface Props {
  log: PriceLogData;
  backHref: string;
  notice?: 'deleted' | null;
}

export function PriceLog({ log, backHref, notice = null }: Props) {
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={backHref} className={styles.iconButton} aria-label={priceTextAr.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.subtitle}>{t.subtitle}</p>
        </div>
      </header>

      <div className={styles.scroll}>
        {notice === 'deleted' && (
          <p role="status" className={styles.info}>
            {t.deleted}
          </p>
        )}
        {log.expiringQuotes > 0 && (
          <p role="status" className={styles.info}>
            {t.expiringCount(log.expiringQuotes)}
          </p>
        )}

        {log.materials.length === 0 ? (
          <div className={styles.empty}>
            <strong>{t.empty}</strong>
            <p>{t.emptyNote}</p>
          </div>
        ) : (
          <>
            <ul className={styles.list} aria-label={t.title}>
              {log.materials.map((m) => (
                <li key={m.key} className={styles.listRow}>
                  <Link href={priceHistoryPath(m.material, m.unit)} className={`${styles.rowText} ${styles.rowLink}`} aria-label={t.openLabel(m.material, m.unit)}>
                    <strong>{m.material}</strong>
                    <small>
                      {t.lastUpdate(dayMonthAr(m.latest.recordedOn), m.unit)}
                      <StatusTag status={m.status} />
                    </small>
                  </Link>
                  <span className={styles.rowValue}>
                    <bdi dir="ltr">{formatAmount(m.latest.priceLyd)}</bdi> {priceTextAr.lyd}
                  </span>
                </li>
              ))}
            </ul>
            <p className={styles.hint}>{t.noForecast}</p>
          </>
        )}
      </div>

      <div className={styles.actions}>
        <Link href={PRICE_NEW_PATH} className={styles.primary}>
          {t.add}
        </Link>
      </div>
    </main>
  );
}
