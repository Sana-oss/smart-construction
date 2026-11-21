// Contracts and payments (design S17.1). Server Component: every figure comes from the finance domain
// (contractSummary); this file only displays them (rule R5).

import Link from 'next/link';
import { formatAmount } from '@/shared-kernel';
import type { ContractsView } from '../application/contracts';
import { BackIcon } from './icons';
import { contractCountAr, contractsTextAr } from './messages.ar';
import { CONTRACT_NEW_PATH, contractPath } from './routes';
import styles from './expense.module.css';

const t = contractsTextAr.list;

interface Props {
  view: ContractsView;
  projectName: string;
  backHref: string;
  notice?: 'added' | 'deleted' | null;
}

export function ContractList({ view, projectName, backHref, notice = null }: Props) {
  const { contracts } = view;
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={backHref} className={styles.iconButton} aria-label={contractsTextAr.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.subtitle}>
            {projectName} · {contractCountAr(contracts.length)}
          </p>
        </div>
      </header>

      <div className={styles.scroll}>
        {notice && (
          <p role="status" className={styles.info}>
            {notice === 'added' ? t.added : t.deleted}
          </p>
        )}

        {contracts.length === 0 ? (
          <div className={styles.empty}>
            <strong>{t.empty}</strong>
            <p>{t.emptyNote}</p>
          </div>
        ) : (
          <ul className={styles.list} aria-label={t.title}>
            {contracts.map((c) => (
              <li key={c.id}>
                <Link href={contractPath(c.id)} className={`${styles.listRow} ${styles.rowLink}`}>
                  <span className={styles.rowText}>
                    <strong>{c.title}</strong>
                    <small>{t.contractor(c.contractor)}</small>
                    <small>{t.paidRemaining(formatAmount(c.summary.paid), formatAmount(c.summary.remaining))}</small>
                  </span>
                  <span className={styles.rowValue}>
                    <bdi dir="ltr">{formatAmount(c.valueLyd)}</bdi> {contractsTextAr.lyd}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {contracts.length > 0 && <p className={styles.hint}>{t.context}</p>}
      </div>

      <div className={styles.actions}>
        <Link href={CONTRACT_NEW_PATH} className={styles.primary}>
          {t.add}
        </Link>
      </div>
    </main>
  );
}
