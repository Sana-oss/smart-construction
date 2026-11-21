// One installment (design S17.3 «تفاصيل الدفعة»): its due condition, its transfer, the retained part. Server Component:
// the figures and states come from the finance domain (cashNow, paymentStage); this file only displays them (rule R5).
// The design's «اعتماد المهندس» row is NOT built (no engineer accounts, owner's decision of 21 Nov 2026). The due state
// and «all phases done» are computed by the page from projects and documents, because finance may not import them.

import Link from 'next/link';
import { formatAmount, money } from '@/shared-kernel';
import type { ContractRecord, PaymentRecord } from '../application/contracts';
import { cashNow, paymentStage, type DueState } from '../domain/payments';
import { BackIcon } from './icons';
import { PayForm } from './PayForm';
import { PaymentUndoButton } from './PaymentUndoButton';
import { ReleaseForm } from './ReleaseForm';
import { settleTextAr } from './messages.ar';
import type { PayFormState, ReleaseFormState } from './settle-form-state';
import styles from './expense.module.css';

const t = settleTextAr;
const longDateAr = (iso: string) =>
  new Intl.DateTimeFormat('ar-LY', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Tripoli' }).format(new Date(`${iso}T12:00:00Z`));

interface Props {
  contract: ContractRecord;
  payment: PaymentRecord;
  due: DueState;
  phaseName: string | null;
  /** Every phase of the project is «منجزة»: the release asks for no confirmation. */
  allPhasesDone: boolean;
  today: string;
  payAction: (prev: PayFormState, form: FormData) => Promise<PayFormState>;
  releaseAction: (prev: ReleaseFormState, form: FormData) => Promise<ReleaseFormState>;
  undoPaymentAction: () => Promise<void>;
  undoReleaseAction: () => Promise<void>;
  backHref: string;
  notice?: 'paid' | 'paid-no-expense' | 'released' | 'undone-paid' | 'undone-release' | null;
}

function Row({ title, state, note }: { title: string; state: string; note: string }) {
  return (
    <li className={styles.listRow}>
      <span className={styles.rowText}>
        <strong>{title}</strong>
        <small>{note}</small>
      </span>
      <span className={styles.rowValue}>{state}</span>
    </li>
  );
}

export function PaymentDetail(props: Props) {
  const { contract, payment, due, phaseName, allPhasesDone, today, notice = null } = props;
  const stage = paymentStage(payment);
  const noticeText = {
    paid: t.notice.paid,
    'paid-no-expense': t.notice.paidNoExpense,
    released: t.notice.released,
    'undone-paid': t.notice.undonePaid,
    'undone-release': t.notice.undoneRelease,
  };
  const dueRow =
    due.state === 'not_tied'
      ? t.due.notTied
      : due.state === 'due'
        ? t.due.due
        : t.due.waiting(due.gaps.map((g) => t.gap[g]).join('، '));
  const transferRow = payment.paidOn === null ? t.transfer.unpaid : t.transfer.paid(longDateAr(payment.paidOn));
  const retainedRow =
    stage === 'scheduled' || !money(payment.retainedLyd).gt(0)
      ? null
      : payment.releasedOn === null
        ? t.retained.held(formatAmount(payment.retainedLyd))
        : t.retained.released(formatAmount(payment.retainedLyd), longDateAr(payment.releasedOn));

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={props.backHref} className={styles.iconButton} aria-label={t.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{t.pageTitle}</h1>
          <p className={styles.subtitle}>{t.contractLine(contract.title, payment.title)}</p>
        </div>
      </header>

      <div className={styles.scroll}>
        {notice && (
          <p role="status" className={styles.info}>
            {noticeText[notice]}
          </p>
        )}

        <div className={styles.summaryCard}>
          <small>{t.amount}</small>
          <strong>
            <bdi dir="ltr">{formatAmount(payment.amountLyd)}</bdi> {t.lyd}
          </strong>
          {phaseName && <p>{phaseName}</p>}
        </div>

        <ul className={styles.list} aria-label={t.pageTitle}>
          <Row title={t.due.title} state={dueRow[0]} note={dueRow[1]} />
          <Row title={t.transfer.title} state={transferRow[0]} note={transferRow[1]} />
          {retainedRow && <Row title={t.retained.title} state={retainedRow[0]} note={retainedRow[1]} />}
        </ul>

        {stage === 'scheduled' && <PayForm action={props.payAction} today={today} gaps={due.state === 'waiting' ? due.gaps : null} cash={formatAmount(cashNow(payment))} />}

        {stage === 'paid_retained_held' && (
          <ReleaseForm action={props.releaseAction} today={today} retained={formatAmount(payment.retainedLyd)} allPhasesDone={allPhasesDone} />
        )}

        {stage !== 'scheduled' && payment.releasedOn === null && (
          <PaymentUndoButton
            action={props.undoPaymentAction}
            label={t.undo.payment}
            ariaLabel={t.undo.actionLabel(t.undo.payment, payment.title)}
            confirm={t.undo.paymentConfirm(payment.title)}
          />
        )}
        {payment.releasedOn !== null && (
          <PaymentUndoButton
            action={props.undoReleaseAction}
            label={t.undo.release}
            ariaLabel={t.undo.actionLabel(t.undo.release, payment.title)}
            confirm={t.undo.releaseConfirm(payment.title)}
          />
        )}

        <p className={styles.hint}>{t.disclaimer}</p>
      </div>
    </main>
  );
}
