// Obligations and expected income (design S16.1 «الالتزامات والدخل»; FR-FIN-06, FR-FIN-07; slice 1 of 3.7).
// Server Component: every number comes from the finance domain (currentLiquidity, cashflowOutlook); this file only
// displays them (rule R5). The design's card shows «السيولة الحالية» and the 30-day totals; the line
// «الرصيد المتوقع بعد 30 يومًا» is S18.1's figure, shown here too so the owner sees it where the data is entered.

import Link from 'next/link';
import { formatAmount, type Money } from '@/shared-kernel';
import type { CashflowView } from '../application/cashflow';
import { DeleteMovementButton } from './DeleteMovementButton';
import { BackIcon } from './icons';
import { cashflowTextAr as t, expenseTextAr } from './messages.ar';
import { CASHFLOW_NEW_PATH } from './routes';
import styles from './expense.module.css';

const dayMonthAr = (iso: string) =>
  new Intl.DateTimeFormat('ar-LY', { day: 'numeric', month: 'long', timeZone: 'Africa/Tripoli' }).format(new Date(`${iso}T12:00:00Z`));
const fullDateAr = (iso: string) =>
  new Intl.DateTimeFormat('ar-LY', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Tripoli' }).format(
    new Date(`${iso}T12:00:00Z`),
  );

/** <bdi dir="ltr"> keeps the digits (and a minus sign) in the right order inside Arabic text. */
const Lyd = ({ value }: { value: Money | string }) => (
  <>
    <bdi dir="ltr">{formatAmount(value)}</bdi> {expenseTextAr.lyd}
  </>
);

interface Props {
  view: CashflowView;
  backHref: string;
  notice?: 'added' | 'deleted' | null;
}

export function CashflowList({ view, backHref, notice = null }: Props) {
  const { liquidity, outlook, window: w } = view;
  const overdue = view.items.filter((i) => i.overdue).length;

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

        {/* Design S16.1 summary */}
        <div className={styles.summaryCard}>
          <small>{t.liquidity}</small>
          <strong>{liquidity ? <Lyd value={liquidity.amount} /> : t.liquidityMissing}</strong>
          <p>{t.windowTotals(formatAmount(w.income), formatAmount(w.obligations))}</p>
        </div>
        <p className={styles.hint}>{liquidity ? t.liquidityNote(fullDateAr(liquidity.asOf)) : t.liquidityMissingNote}</p>

        {outlook && (
          <div className={styles.list}>
            <div className={styles.listRow}>
              <span className={styles.rowText}>
                <strong>{t.balance}</strong>
                <small>{t.disclaimer}</small>
              </span>
              <span className={styles.rowValue}>
                <Lyd value={outlook.balanceAtEnd} />
              </span>
            </div>
          </div>
        )}
        {outlook?.shortfall && (
          <p role="status" className={styles.errorSummary}>
            {t.shortfallBefore(dayMonthAr(outlook.shortfall.from))} <bdi dir="ltr">{formatAmount(outlook.shortfall.lowest)}</bdi>{' '}
            {t.shortfallAfter}
          </p>
        )}
        {overdue > 0 && (
          <p role="note" className={styles.info}>
            {t.overdue(overdue)}
          </p>
        )}

        {view.items.length === 0 ? (
          <div className={styles.empty}>
            <strong>{t.empty}</strong>
            <p>{t.emptyNote}</p>
          </div>
        ) : (
          <>
            <ul className={styles.list} aria-label={t.title}>
              {view.items.map((m) => (
                <li key={`${m.kind}-${m.id}`} className={styles.listRow}>
                  <span className={styles.rowText}>
                    <strong>{m.title}</strong>
                    <small>
                      {[
                        m.kind === 'income' ? t.income : t.obligation,
                        m.kind === 'income' ? t.expectedOn(dayMonthAr(m.date)) : t.dueOn(dayMonthAr(m.date)),
                        m.overdue ? t.overdueTag : null,
                        m.party,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </small>
                  </span>
                  <span className={styles.rowValue}>
                    {m.kind === 'obligation' ? '− ' : '+ '}
                    <Lyd value={m.amountLyd} />
                    <DeleteMovementButton kind={m.kind} id={m.id} title={m.title} />
                  </span>
                </li>
              ))}
            </ul>
            <p className={styles.hint}>{t.doneHint}</p>
          </>
        )}
      </div>

      <div className={styles.actions}>
        <Link href={CASHFLOW_NEW_PATH} className={styles.primary}>
          {t.add}
        </Link>
      </div>
    </main>
  );
}
