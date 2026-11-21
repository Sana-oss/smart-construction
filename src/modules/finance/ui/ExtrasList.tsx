// Extra works and changes (FR-FIN-10). No design screen: built from the design's card and list styles (change
// register). Server Component: the totals and the contingency use come from the finance domain (contingencyUse).

import Link from 'next/link';
import { formatAmount } from '@/shared-kernel';
import type { ExtrasView } from '../application/extras';
import { ExtraButton } from './ExtraButton';
import { setExtraContractAction } from './extra-actions';
import { BackIcon } from './icons';
import { extrasTextAr } from './messages.ar';
import { EXTRA_NEW_PATH } from './routes';
import styles from './expense.module.css';

const t = extrasTextAr.list;
const dayMonthAr = (iso: string) =>
  new Intl.DateTimeFormat('ar-LY', { day: 'numeric', month: 'long', timeZone: 'Africa/Tripoli' }).format(new Date(`${iso}T12:00:00Z`));

interface Props {
  view: ExtrasView;
  phases: { id: string; name: string }[];
  /** The project's contracts, to link each work to one (3.16 deepening). */
  contracts: { id: string; title: string }[];
  backHref: string;
  notice?: 'added' | 'changed' | 'deleted' | 'linked' | 'unlinked' | null;
}

export function ExtrasList({ view, phases, contracts, backHref, notice = null }: Props) {
  const { use, extras } = view;
  const phaseName = (id: string | null) => (id ? phases.find((p) => p.id === id)?.name : undefined);
  const contractTitle = (id: string | null) => (id ? contracts.find((c) => c.id === id)?.title : undefined);
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={backHref} className={styles.iconButton} aria-label={extrasTextAr.back}>
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
            {notice === 'added' ? t.added : notice === 'changed' ? t.changed : notice === 'linked' ? t.linked : notice === 'unlinked' ? t.unlinked : t.deleted}
          </p>
        )}

        <div className={styles.summaryCard}>
          <small>{t.approved}</small>
          <strong>
            <bdi dir="ltr">{formatAmount(use.approved)}</bdi> {extrasTextAr.lyd}
          </strong>
          <p>{t.contingencyLeft(formatAmount(use.contingencyLeft))}</p>
        </div>
        {use.proposed.gt(0) && <p className={styles.hint}>{t.proposed(formatAmount(use.proposed))}</p>}

        {extras.length === 0 ? (
          <div className={styles.empty}>
            <strong>{t.empty}</strong>
            <p>{t.emptyNote}</p>
          </div>
        ) : (
          <ul className={styles.list} aria-label={t.title}>
            {extras.map((e) => (
              <li key={e.id} className={styles.listRow}>
                <span className={styles.rowText}>
                  <strong>{e.title}</strong>
                  <small>{[extrasTextAr.status[e.status], dayMonthAr(e.occurredOn), phaseName(e.phaseId), contractTitle(e.contractId), e.note].filter(Boolean).join(' · ')}</small>
                  {contracts.length > 0 && (
                    <form action={setExtraContractAction.bind(null, e.id)} className={styles.inlineForm}>
                      <select name="contractId" defaultValue={e.contractId ?? ''} aria-label={t.linkLabel(e.title)}>
                        <option value="">{t.noContract}</option>
                        {contracts.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className={styles.linkButton}>
                        {t.link}
                      </button>
                    </form>
                  )}
                </span>
                <span className={styles.rowValue}>
                  <bdi dir="ltr">{formatAmount(e.costLyd)}</bdi> {extrasTextAr.lyd}
                  {e.status === 'proposed' && (
                    <>
                      <ExtraButton
                        id={e.id}
                        action="approved"
                        label={t.approve}
                        ariaLabel={t.actionLabel(t.approve, e.title)}
                        confirm={t.approveConfirm(e.title, formatAmount(e.costLyd))}
                      />
                      <ExtraButton id={e.id} action="rejected" label={t.reject} ariaLabel={t.actionLabel(t.reject, e.title)} confirm={t.rejectConfirm(e.title)} />
                    </>
                  )}
                  <ExtraButton id={e.id} action="delete" label={t.delete} ariaLabel={t.actionLabel(t.delete, e.title)} confirm={t.deleteConfirm(e.title)} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.actions}>
        <Link href={EXTRA_NEW_PATH} className={styles.primary}>
          {t.add}
        </Link>
      </div>
    </main>
  );
}
