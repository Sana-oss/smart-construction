// One line of the quantity table (design S20.2 «تفاصيل بند»; FR-MAT-02, FR-MAT-03). Server Component: every number comes
// from the materials domain (itemProgress); this file only displays it (rule R5). The design's «المتبقي بالموقع · حسب
// آخر جرد» waits for the stock count (3.23).

import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatAmount } from '@/shared-kernel';
import type { ItemDetail } from '../application/quantities';
import { ConfirmActionButton } from './ConfirmActionButton';
import { BackIcon } from './icons';
import { qtyTextAr } from './messages.ar';
import { deleteItemAction } from './quantity-actions';
import { MATERIALS_PATH, purchasePath } from './routes';
import styles from './materials.module.css';

const t = qtyTextAr.item;
const dayMonthAr = (iso: string) =>
  new Intl.DateTimeFormat('ar-LY', { day: 'numeric', month: 'long', timeZone: 'Africa/Tripoli' }).format(new Date(`${iso}T12:00:00Z`));

export type ItemNotice = 'added' | 'purchased' | 'expense_pending' | 'expense_finished' | 'not_deleted' | null;

interface Props {
  detail: ItemDetail;
  phaseName: string | null;
  notice?: ItemNotice;
  /** The app's action that makes the missing expense of one purchase (it needs finance, so it comes from the app). */
  finishExpense: (purchaseId: string) => () => Promise<void>;
}

export function ItemDetailScreen({ detail, phaseName, notice = null, finishExpense }: Props) {
  const { item, progress, purchases } = detail;
  const last = purchases[0];
  const unit = (v: Parameters<typeof formatAmount>[0], label: string) => (
    <>
      <bdi dir="ltr">{formatAmount(v)}</bdi> {label}
    </>
  );
  const row = (title: string, note: ReactNode, value: ReactNode) => (
    <li className={styles.listRow}>
      <span className={styles.rowText}>
        <strong>{title}</strong>
        <small>{note}</small>
      </span>
      <span className={styles.rowValue}>{value}</span>
    </li>
  );
  const noticeText: Record<Exclude<ItemNotice, null>, string> = {
    added: qtyTextAr.table.added,
    purchased: t.purchased,
    expense_pending: t.expensePendingNotice,
    expense_finished: t.expenseFinished,
    not_deleted: t.cannotDelete,
  };

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={MATERIALS_PATH} className={styles.iconButton} aria-label={qtyTextAr.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{item.material}</h1>
          <p className={styles.subtitle}>{t.subtitle(phaseName)}</p>
        </div>
      </header>

      <div className={styles.scroll}>
        {notice && (
          <p role="status" className={notice === 'expense_pending' || notice === 'not_deleted' ? styles.errorSummary : styles.info}>
            {noticeText[notice]}
          </p>
        )}
        <div className={styles.summaryCard}>
          <small>{t.planned}</small>
          <strong>{unit(progress.plannedQty, item.unit)}</strong>
          <p>{t.purchasedLine(formatAmount(progress.purchasedQty), formatAmount(progress.remainingQty), item.unit)}</p>
        </div>
        {progress.isOver && (
          <p role="status" className={styles.errorSummary}>
            {t.over(formatAmount(progress.overBy), item.unit)}
          </p>
        )}

        <ul className={styles.list} aria-label={item.material}>
          {row(t.allowed, progress.wastePct.gt(0) ? t.allowedNote(formatAmount(progress.wastePct)) : t.noWaste, unit(progress.allowedQty, item.unit))}
          {last && row(t.lastPurchase, [dayMonthAr(last.purchasedOn), last.supplier].filter(Boolean).join(' · '), unit(last.qty, item.unit))}
          {last && row(t.lastPrice, t.perUnit(item.unit), unit(last.unitPriceLyd, qtyTextAr.lyd))}
          {item.source && row(t.source, item.source, '')}
          {item.verifiedBy && row(t.verifiedBy, item.verifiedBy, '')}
        </ul>

        <section aria-labelledby="purchases-title">
          <h2 id="purchases-title" className={styles.label}>
            {t.purchases}
          </h2>
          {purchases.length === 0 ? (
            <p className={styles.hint}>{t.noPurchases}</p>
          ) : (
            <ul className={styles.list} aria-label={t.purchases}>
              {purchases.map((p) => (
                <li key={p.id} className={styles.listRow}>
                  <span className={styles.rowText}>
                    <strong>{dayMonthAr(p.purchasedOn)}</strong>
                    <small>
                      <bdi dir="ltr">{t.purchaseRow(formatAmount(p.qty), item.unit, formatAmount(p.unitPriceLyd))}</bdi>
                      {p.supplier ? ` · ${p.supplier}` : ''}
                    </small>
                  </span>
                  <span className={styles.rowValue}>
                    {p.expenseRef ? (
                      t.expenseRecorded
                    ) : (
                      <>
                        {t.expensePending}
                        <ConfirmActionButton action={finishExpense(p.id)} label={t.finishExpense} ariaLabel={t.finishExpenseLabel(dayMonthAr(p.purchasedOn))} />
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {purchases.length === 0 && (
          <ConfirmActionButton action={deleteItemAction.bind(null, item.id)} label={t.delete} confirm={t.deleteConfirm(item.material)} />
        )}
      </div>

      <div className={styles.actions}>
        <Link href={purchasePath(item.id)} className={styles.primary}>
          {t.record}
        </Link>
      </div>
    </main>
  );
}
