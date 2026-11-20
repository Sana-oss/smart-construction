// The pre-pour checklists of one phase (3.12; FR-QLT-02). One phase has several pours, so several named checklists.
// No design screen for this list: built from the design's list rows (change register). Server Component: the progress
// comes from the quality domain (checklistProgress); this file only displays it (rule R5).

import Link from 'next/link';
import type { ChecklistWithProgress } from '../application/checklists';
import { BackIcon } from './icons';
import { checklistTextAr } from './messages.ar';
import { checklistPath, newChecklistPath } from './routes';
import styles from './quality.module.css';

const t = checklistTextAr.phase;

interface Props {
  phase: { id: string; name: string };
  checklists: ChecklistWithProgress[];
  backHref: string;
}

export function PhaseChecklists({ phase, checklists, backHref }: Props) {
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={backHref} className={styles.iconButton} aria-label={checklistTextAr.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.subtitle}>{t.subtitle(phase.name)}</p>
        </div>
      </header>

      <div className={styles.scroll}>
        {checklists.length === 0 ? (
          <div className={styles.empty}>
            <strong>{t.empty}</strong>
            <p>{t.emptyNote}</p>
          </div>
        ) : (
          <ul className={styles.list} aria-label={t.title}>
            {checklists.map(({ checklist, progress }) => (
              <li key={checklist.id} className={styles.listRow}>
                <Link href={checklistPath(checklist.id)} className={`${styles.rowText} ${styles.rowLink}`} aria-label={t.open(checklist.title)}>
                  <strong>{checklist.title}</strong>
                  <small>
                    {[t.progress(progress.checked, progress.total), progress.issues > 0 ? t.issues(progress.issues) : null].filter(Boolean).join(' · ')}
                    {checklist.templateStatus === 'unreviewed' && <span className={styles.tag}>{checklistTextAr.unreviewed}</span>}
                  </small>
                </Link>
                <span className={styles.rowValue}>{checklist.status === 'completed' ? t.completed : `${progress.checked}/${progress.total}`}</span>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.hint}>{checklistTextAr.engineerNote}</p>
      </div>

      <div className={styles.actions}>
        <Link href={newChecklistPath(phase.id)} className={styles.primary}>
          {t.add}
        </Link>
      </div>
    </main>
  );
}
