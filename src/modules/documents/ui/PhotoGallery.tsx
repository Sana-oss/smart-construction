// «صور الموقع» (FR-DOC-02, design S31.1): photos grouped by phase, newest first. Server Component.
// Each image is shown through a short-lived signed link (NFR-SEC-03); the grouping comes from the domain.

import Link from 'next/link';
import type { PhotoWithUrl } from '../application/photos';
import { groupPhotosByPhase } from '../domain/photo';
import { photosCountAr, photosTextAr } from './messages.ar';
import { DeletePhotoButton } from './DeletePhotoButton';
import { BackIcon } from './PhotoForm';
import { PHOTO_NEW_PATH } from './routes';
import styles from './photos.module.css';

const t = photosTextAr.gallery;

const dateAr = (iso: string) =>
  new Intl.DateTimeFormat('ar-LY', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Tripoli' }).format(
    new Date(`${iso}T12:00:00Z`),
  );

interface Props {
  photos: PhotoWithUrl[];
  phases: { id: string; position: number; name: string }[];
  homeHref: string;
}

export function PhotoGallery({ photos, phases, homeHref }: Props) {
  const groups = groupPhotosByPhase(photos, phases);
  const phaseName = (id: string | null) => (id ? phases.find((p) => p.id === id)?.name : undefined) ?? t.noPhase;

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={homeHref} className={styles.iconButton} aria-label={photosTextAr.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.subtitle}>{t.subtitle}</p>
        </div>
      </header>

      <div className={styles.scroll}>
        {groups.length === 0 ? (
          <div className={styles.empty}>
            <strong>{t.emptyTitle}</strong>
            <p>{t.emptyBody}</p>
          </div>
        ) : (
          groups.map((g) => {
            const name = phaseName(g.phaseId);
            return (
              <section key={g.phaseId ?? 'none'} className={styles.group} aria-label={name}>
                <div className={styles.groupHead}>
                  <h2>{name}</h2>
                  <small>{t.groupMeta(photosCountAr(g.photos.length), dateAr(g.latest))}</small>
                </div>
                <ul className={styles.grid}>
                  {g.photos.map((p) => (
                    <li key={p.id} className={styles.tile}>
                      {p.url ? (
                        <a href={p.url} target="_blank" rel="noopener noreferrer" className={styles.thumb} aria-label={`${t.open}: ${p.note ?? name}`}>
                          <img src={p.url} alt={p.note ?? t.photoAlt(name, dateAr(p.takenOn))} loading="lazy" />
                        </a>
                      ) : (
                        <span className={styles.thumb}>
                          <span className={styles.missing}>{t.noLink}</span>
                        </span>
                      )}
                      <span className={styles.caption}>{[dateAr(p.takenOn), p.note].filter(Boolean).join(' · ')}</span>
                      <DeletePhotoButton photoId={p.id} label={`${t.delete}: ${p.note ?? dateAr(p.takenOn)}`} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </div>

      <div className={styles.actions}>
        <Link href={PHOTO_NEW_PATH} className={styles.primary}>
          {t.add}
        </Link>
      </div>
    </main>
  );
}
