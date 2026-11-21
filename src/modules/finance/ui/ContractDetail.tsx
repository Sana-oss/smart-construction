// One contract and its payment schedule (design S17.2). Server Component: the figures come from the finance domain
// (contractSummary); this file only displays them (rule R5). The contract copy (a document) is composed by the page,
// because documents is another module.

import Link from 'next/link';
import { formatAmount, money } from '@/shared-kernel';
import type { ContractDetail as ContractDetailData } from '../application/contracts';
import type { ContractExtras } from '../domain/extras';
import { paymentStage, type DueState } from '../domain/payments';
import { ContractButton } from './ContractButton';
import { BackIcon } from './icons';
import { contractsTextAr, settleTextAr } from './messages.ar';
import { contractEditPath, EXTRAS_PATH, paymentEditPath, paymentNewPath, paymentPath } from './routes';
import styles from './expense.module.css';

const t = contractsTextAr.detail;

interface Props {
  detail: ContractDetailData;
  phases: { id: string; name: string }[];
  /** FR-FIN-09: is each installment due? Computed by the page from the phase and its photos (other modules). */
  dueByPayment: Record<string, DueState>;
  /** Extra works linked to this contract (3.16): shown, never part of its numbers. */
  extras: ContractExtras;
  /** The contract copy: a document of type «عقد» with its short-lived link; null when none is linked. */
  copy: { title: string; url: string | null } | null;
  backHref: string;
  notice?: 'added' | 'updated' | 'payment-added' | 'payment-updated' | 'payment-deleted' | null;
}

export function ContractDetail({ detail, phases, dueByPayment, extras, copy, backHref, notice = null }: Props) {
  const { contract, payments } = detail;
  const s = contract.summary;
  const phaseName = (id: string | null) => (id ? phases.find((p) => p.id === id)?.name ?? null : null);
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={backHref} className={styles.iconButton} aria-label={contractsTextAr.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{contract.title}</h1>
          <p className={styles.subtitle}>{contract.contractor}</p>
        </div>
      </header>

      <div className={styles.scroll}>
        {notice && (
          <p role="status" className={styles.info}>
            {notice === 'added'
              ? t.contractAdded
              : notice === 'updated'
                ? t.contractUpdated
                : notice === 'payment-added'
                  ? t.paymentAdded
                  : notice === 'payment-updated'
                    ? t.paymentUpdated
                    : t.paymentDeleted}
          </p>
        )}

        <div className={styles.summaryCard}>
          <small>{t.contractValue}</small>
          <strong>
            <bdi dir="ltr">{formatAmount(s.value)}</bdi> {contractsTextAr.lyd}
          </strong>
          <p>{t.paidRemaining(formatAmount(s.paid), formatAmount(s.remaining))}</p>
        </div>
        {s.scheduleExceedsValue && (
          <p role="alert" className={styles.errorSummary}>
            {t.scheduleExceeds(formatAmount(s.overScheduled))}
          </p>
        )}

        <ul className={styles.list} aria-label={t.schedule}>
          {payments.length === 0 ? (
            <li className={styles.empty}>
              <strong>{t.noPayments}</strong>
              <p>{t.noPaymentsNote}</p>
            </li>
          ) : (
            payments.map((p) => {
              const stage = paymentStage(p);
              const due = dueByPayment[p.id];
              const stageLabel =
                stage !== 'scheduled' ? settleTextAr.stage.paid : due?.state === 'due' ? settleTextAr.stage.due : due?.state === 'waiting' ? settleTextAr.stage.waiting : settleTextAr.stage.scheduled;
              return (
                <li key={p.id} className={styles.listRow}>
                  <Link href={paymentPath(contract.id, p.id)} className={`${styles.rowText} ${styles.rowLink}`}>
                    <strong>{p.title}</strong>
                    <small>{t.paymentNote(stageLabel, phaseName(p.phaseId), money(p.retainedLyd).gt(0) ? formatAmount(p.retainedLyd) : null)}</small>
                  </Link>
                  <span className={styles.rowValue}>
                    <bdi dir="ltr">{formatAmount(p.amountLyd)}</bdi> {contractsTextAr.lyd}
                    {stage === 'scheduled' && (
                      <Link href={paymentEditPath(contract.id, p.id)} className={styles.linkButton} aria-label={t.actionLabel(t.editPayment, p.title)}>
                        {t.editPayment}
                      </Link>
                    )}
                    {stage === 'scheduled' && (
                      <ContractButton
                        contractId={contract.id}
                        paymentId={p.id}
                        label={t.delete}
                        ariaLabel={t.actionLabel(t.delete, p.title)}
                        confirm={t.deletePaymentConfirm(p.title)}
                      />
                    )}
                  </span>
                </li>
              );
            })
          )}
          {s.unscheduled.gt(0) && (
            <li className={styles.listRow}>
              <span className={styles.rowText}>
                <strong>{t.unscheduled}</strong>
                <small>{t.unscheduledNote}</small>
              </span>
              <span className={styles.rowValue}>
                <bdi dir="ltr">{formatAmount(s.unscheduled)}</bdi> {contractsTextAr.lyd}
              </span>
            </li>
          )}
        </ul>
        {s.retained.gt(0) && <p className={styles.hint}>{t.retainedTotal(formatAmount(s.retained))}</p>}

        <ul className={styles.list} aria-label={t.contractValue}>
          {contract.scope && (
            <li className={styles.listRow}>
              <span className={styles.rowText}>
                <strong>{t.scope}</strong>
                <small>{contract.scope}</small>
              </span>
            </li>
          )}
          <li className={styles.listRow}>
            <span className={styles.rowText}>
              <strong>{t.cleanup}</strong>
              <small>{contract.cleanupClause ?? t.cleanupNone}</small>
            </span>
          </li>
          <li className={styles.listRow}>
            <span className={styles.rowText}>
              <strong>{t.copy}</strong>
              <small>{copy ? copy.title : t.copyNone}</small>
            </span>
            <span className={styles.rowValue}>
              {copy?.url && (
                <a href={copy.url} className={styles.linkButton} target="_blank" rel="noopener noreferrer">
                  {t.view}
                </a>
              )}
            </span>
          </li>
        </ul>

        <ul className={styles.list} aria-label={t.extras}>
          <li className={styles.listRow}>
            <span className={styles.rowText}>
              <strong>{t.extras}</strong>
              <small>
                {extras.approvedCount + extras.proposedCount === 0 ? t.extrasNoteEmpty : t.extrasNote(formatAmount(extras.approved), formatAmount(extras.proposed))}
              </small>
            </span>
            <span className={styles.rowValue}>
              <Link href={EXTRAS_PATH} className={styles.linkButton}>
                {t.view}
              </Link>
            </span>
          </li>
        </ul>
        <p className={styles.hint}>{t.extrasHint}</p>

        <Link href={contractEditPath(contract.id)} className={styles.linkButton} aria-label={t.actionLabel(t.editContract, contract.title)}>
          {t.editContract}
        </Link>
        <ContractButton contractId={contract.id} label={t.deleteContract} ariaLabel={t.actionLabel(t.deleteContract, contract.title)} confirm={t.deleteContractConfirm(contract.title)} />
      </div>

      <div className={styles.actions}>
        <Link href={paymentNewPath(contract.id)} className={styles.primary}>
          {t.addPayment}
        </Link>
      </div>
    </main>
  );
}
