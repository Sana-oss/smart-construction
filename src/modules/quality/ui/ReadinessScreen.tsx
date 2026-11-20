// The project's readiness list (3.15; FR-PRJ-05, FR-PRJ-02). One list per project (owner's decision of 20 Nov 2026), from
// the readiness template; each item opens the same item form as the pre-pour checks, labelled «متوفر / ناقص / لا ينطبق».
// Server Component: the gaps come from the quality domain (readinessGaps); this file only displays them (rule R5).

import Link from 'next/link';
import type { ReadinessView } from '../application/checklists';
import { createReadinessAction } from './checklist-actions';
import { BackIcon } from './icons';
import { checklistTextAr, readinessTextAr as t } from './messages.ar';
import { checkItemPath } from './routes';
import styles from './quality.module.css';

interface Props {
  view: ReadinessView;
  addFloor: boolean;
  backHref: string;
  notice?: 'saved' | null;
}

export function ReadinessScreen({ view, addFloor, backHref, notice = null }: Props) {
  const { detail, gaps } = view;
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={backHref} className={styles.iconButton} aria-label={checklistTextAr.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.subtitle}>{detail ? `${t.subtitle} · ${t.progress(detail.progress.checked, detail.progress.total)}` : t.subtitle}</p>
        </div>
      </header>

      <div className={styles.scroll}>
        {notice === 'saved' && (
          <p role="status" className={styles.info}>
            {t.saved}
          </p>
        )}
        {addFloor && <p className={styles.errorSummary}>{t.addFloorNote}</p>}
        {!detail ? (
          <div className={styles.empty}>
            <strong>{t.empty}</strong>
            <p>{t.emptyNote}</p>
          </div>
        ) : (
          <>
            {detail.checklist.templateStatus === 'unreviewed' && (
              <p className={styles.hint}>
                <span className={styles.tag}>{checklistTextAr.unreviewed}</span>
              </p>
            )}
            <p role="status" className={gaps.length > 0 ? styles.errorSummary : styles.info}>
              {gaps.length > 0 ? t.gapsCount(gaps.length) : t.ready}
            </p>
            <ul className={styles.list} aria-label={t.title}>
              {detail.items.map((item) => (
                <li key={item.id} className={styles.listRow}>
                  <Link
                    href={checkItemPath(detail.checklist.id, item.id)}
                    className={`${styles.rowText} ${styles.rowLink}`}
                    aria-label={checklistTextAr.list.open(item.text)}
                  >
                    <strong>{item.text}</strong>
                    <small>{item.note || ' '}</small>
                  </Link>
                  <span className={styles.rowValue}>{checklistTextAr.readinessResult[item.result ?? 'none']}</span>
                </li>
              ))}
            </ul>
            <p className={styles.hint}>{t.gateNote}</p>
          </>
        )}
        <p className={styles.hint}>{checklistTextAr.engineerNote}</p>
      </div>

      {!detail && (
        <div className={styles.actions}>
          <form action={createReadinessAction}>
            <button type="submit" className={styles.primary}>
              {t.create}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
