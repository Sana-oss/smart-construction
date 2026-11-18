// «وثائق المشروع» (FR-DOC-01, design S30.1), and one phase's documents (S10.4) when `phaseId` is given.
// Server Component. Each document opens through a short-lived signed link (NFR-SEC-03).
// Not built (change register, 18 Nov): the design's «معتمد» / «موقّع» badges (engineer approval through the app is
// excluded), and "contract number" labels such as «CT-002» (no such field).

import Link from 'next/link';
import { Fragment } from 'react';
import type { DocumentWithUrl } from '../application/documents';
import { sizeAr } from './compress-photo';
import { DeleteDocumentButton } from './DeleteDocumentButton';
import { documentKindAr, documentsTextAr, documentTypeAr, filesCountAr } from './messages.ar';
import { BackIcon } from './PhotoForm';
import { DOCUMENTS_PATH, newDocumentPath, PHOTOS_PATH } from './routes';
import styles from './documents.module.css';

const t = documentsTextAr.list;

const dateAr = (iso: string) =>
  new Intl.DateTimeFormat('ar-LY', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Tripoli' }).format(new Date(iso));

interface Props {
  documents: DocumentWithUrl[];
  phases: { id: string; name: string }[];
  /** Show only this phase's documents (S10.4). */
  phaseId?: string | null;
  /** Where the back button goes: the dashboard, or the phase page when filtered. */
  backHref: string;
}

export function DocumentList({ documents, phases, phaseId = null, backHref }: Props) {
  const phase = phaseId ? phases.find((p) => p.id === phaseId) : undefined;
  const shown = phase ? documents.filter((d) => d.phaseId === phase.id) : documents;
  const phaseName = (id: string | null) => (id ? phases.find((p) => p.id === id)?.name : undefined);

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={backHref} className={styles.iconButton} aria-label={documentsTextAr.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{phase ? t.phaseTitle : t.title}</h1>
          <p className={styles.subtitle}>{phase ? t.phaseSubtitle(phase.name, filesCountAr(shown.length)) : t.subtitle}</p>
        </div>
      </header>

      <div className={styles.scroll}>
        {shown.length === 0 ? (
          <div className={styles.empty}>
            <strong>{t.emptyTitle}</strong>
            <p>{t.emptyBody}</p>
          </div>
        ) : (
          <ul className={`${styles.list} ${styles.plainList}`} aria-label={phase ? t.phaseTitle : t.title}>
            {shown.map((d) => {
              const meta = [
                documentKindAr[d.kind],
                phase ? null : phaseName(d.phaseId),
                d.version ? t.version(d.version) : null,
                documentTypeAr[d.contentType],
                sizeAr(d.sizeBytes),
                dateAr(d.createdAt),
              ];
              return (
                <li key={d.id} className={styles.listRow}>
                  <span className={styles.rowText}>
                    <strong>{d.title}</strong>
                    {/* Each part in its own <bdi>: "PDF", "·" and a size like "1 ك.ب" would otherwise merge into one
                        left-to-right run and show in the wrong order ("1 · PDF ك.ب"). */}
                    <small>
                      {meta.filter(Boolean).map((m, i) => (
                        <Fragment key={i}>
                          {i > 0 && ' · '}
                          <bdi>{m}</bdi>
                        </Fragment>
                      ))}
                    </small>
                  </span>
                  <span className={styles.rowActions}>
                    {d.url ? (
                      <a href={d.url} target="_blank" rel="noopener noreferrer" className={styles.smallButton} aria-label={t.openLabel(d.title)}>
                        {t.open}
                      </a>
                    ) : (
                      <span className={styles.caption}>{t.noLink}</span>
                    )}
                    <DeleteDocumentButton documentId={d.id} title={d.title} />
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {phase ? (
          <Link href={DOCUMENTS_PATH} className={styles.secondary}>
            {t.allDocuments}
          </Link>
        ) : (
          // Design S30.1: the photo record sits with the documents.
          <div className={styles.list}>
            <Link href={PHOTOS_PATH} className={`${styles.listRow} ${styles.rowLink}`}>
              <span className={styles.rowText}>
                <strong>{t.photosRow}</strong>
                <small>{t.photosNote}</small>
              </span>
            </Link>
          </div>
        )}
      </div>

      <div className={styles.actions}>
        <Link href={newDocumentPath(phase?.id)} className={styles.primary}>
          {t.add}
        </Link>
      </div>
    </main>
  );
}
