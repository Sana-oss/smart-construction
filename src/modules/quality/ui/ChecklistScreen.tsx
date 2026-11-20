// One pre-pour checklist (design S26.1 «قائمة الفحص»; FR-QLT-01). Server Component: the progress comes from the
// quality domain (checklistProgress); this file only displays it (rule R5). The design's «تسجيل بند مشكلة / ربط
// الملاحظة بسجل العيوب» waits for the defects list (3.17).

import Link from 'next/link';
import type { ChecklistDetail } from '../application/checklists';
import { BackIcon } from './icons';
import { checklistTextAr } from './messages.ar';
import { checkItemPath } from './routes';
import styles from './quality.module.css';

const t = checklistTextAr.list;
const dateAr = (iso: string) =>
  new Intl.DateTimeFormat('ar-LY', { day: 'numeric', month: 'long', timeZone: 'Africa/Tripoli' }).format(new Date(`${iso}T12:00:00Z`));

interface Props {
  detail: ChecklistDetail;
  phaseName: string;
  backHref: string;
  notice?: 'created' | 'saved' | null;
}

export function ChecklistScreen({ detail, phaseName, backHref, notice = null }: Props) {
  const { checklist, items, progress } = detail;
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={backHref} className={styles.iconButton} aria-label={checklistTextAr.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{checklist.title}</h1>
          <p className={styles.subtitle}>{t.subtitle(phaseName, progress.checked, progress.total)}</p>
        </div>
      </header>

      <div className={styles.scroll}>
        {notice && (
          <p role="status" className={styles.info}>
            {notice === 'created' ? t.created : t.saved}
          </p>
        )}
        {checklist.templateStatus === 'unreviewed' && (
          <p className={styles.hint}>
            <span className={styles.tag}>{checklistTextAr.unreviewed}</span>
          </p>
        )}
        {progress.issues > 0 && (
          <p role="status" className={styles.errorSummary}>
            {t.issuesCount(progress.issues)}
          </p>
        )}
        {progress.complete && <p className={styles.info}>{t.completed}</p>}

        <ul className={styles.list} aria-label={t.itemsLabel}>
          {items.map((item) => (
            <li key={item.id} className={styles.listRow}>
              <Link href={checkItemPath(checklist.id, item.id)} className={`${styles.rowText} ${styles.rowLink}`} aria-label={t.open(item.text)}>
                <strong>{item.text}</strong>
                <small>
                  {[item.note, item.responsible, item.result === 'issue' && item.recheckOn ? t.recheck(dateAr(item.recheckOn)) : null]
                    .filter(Boolean)
                    .join(' · ') || ' '}
                </small>
              </Link>
              <span className={styles.rowValue}>{checklistTextAr.result[item.result ?? 'none']}</span>
            </li>
          ))}
        </ul>
        <p className={styles.hint}>{checklistTextAr.engineerNote}</p>
      </div>

      <div className={styles.actions}>
        <Link href={backHref} className={styles.secondary}>
          {t.backToPhase}
        </Link>
      </div>
    </main>
  );
}
