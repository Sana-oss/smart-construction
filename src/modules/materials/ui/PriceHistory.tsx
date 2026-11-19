// One material's price history (design S24.2 «تاريخ سعر …»; FR-MAT-08). Server Component: the records come sorted from
// the domain (priceHistory). FR-MAT-09's chart is priority 4 and not built: the list shows the same prices as text.

import Link from 'next/link';
import { formatAmount } from '@/shared-kernel';
import type { PriceWithStatus } from '../application/prices';
import { DeletePriceButton } from './DeletePriceButton';
import { BackIcon } from './icons';
import { priceTextAr } from './messages.ar';
import { priceNewForPath } from './routes';
import { StatusTag } from './StatusTag';
import styles from './materials.module.css';

const t = priceTextAr.history;
const fullDateAr = (iso: string) =>
  new Intl.DateTimeFormat('ar-LY', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Tripoli' }).format(
    new Date(`${iso}T12:00:00Z`),
  );
const Lyd = ({ value }: { value: string }) => (
  <>
    <bdi dir="ltr">{formatAmount(value)}</bdi> {priceTextAr.lyd}
  </>
);

interface Props {
  material: string;
  unit: string;
  prices: PriceWithStatus[];
  backHref: string;
  notice?: 'added' | 'deleted' | null;
}

export function PriceHistory({ material, unit, prices, backHref, notice = null }: Props) {
  const latest = prices[0];
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={backHref} className={styles.iconButton} aria-label={priceTextAr.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{t.title(material)}</h1>
          <p className={styles.subtitle}>{t.subtitle(unit)}</p>
        </div>
      </header>

      <div className={styles.scroll}>
        {notice && (
          <p role="status" className={styles.info}>
            {notice === 'added' ? priceTextAr.log.added : priceTextAr.log.deleted}
          </p>
        )}

        {!latest ? (
          <div className={styles.empty}>
            <strong>{t.notFound}</strong>
          </div>
        ) : (
          <>
            {/* Design S24.2 summary */}
            <div className={styles.summaryCard}>
              <small>{t.latest}</small>
              <strong>
                <Lyd value={latest.priceLyd} />
              </strong>
              <p>{[latest.supplier, fullDateAr(latest.recordedOn)].filter(Boolean).join(' · ')}</p>
            </div>

            <ul className={styles.list} aria-label={t.title(material)}>
              {prices.map((p) => (
                <li key={p.id} className={styles.listRow}>
                  <span className={styles.rowText}>
                    <strong>{fullDateAr(p.recordedOn)}</strong>
                    <small>
                      {[p.supplier, p.kind === 'paid' ? priceTextAr.status.paid : null, p.transportLyd ? t.transport(formatAmount(p.transportLyd)) : null, p.note]
                        .filter(Boolean)
                        .join(' · ')}
                      <StatusTag status={p.status} />
                    </small>
                  </span>
                  <span className={styles.rowValue}>
                    <Lyd value={p.priceLyd} />
                    <DeletePriceButton id={p.id} material={material} unit={unit} date={fullDateAr(p.recordedOn)} />
                  </span>
                </li>
              ))}
            </ul>
            <p className={styles.hint}>{t.noForecast}</p>
          </>
        )}
      </div>

      <div className={styles.actions}>
        <Link href={priceNewForPath(material, unit)} className={styles.primary}>
          {t.addUpdate}
        </Link>
      </div>
    </main>
  );
}
