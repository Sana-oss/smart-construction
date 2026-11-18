// Phases screen (FR-PRJ-03). Design: S09.1 «مراحل المشروع». Server Component.
// The numbers (delay, counts) come from the domain (phaseDelay, phasesOverview); this file only displays them (R5).
// Differences from the design (change register, 18 Nov): no "progress %" per phase or overall (needs tasks,
// FR-PRJ-04, and an agreed formula); each row opens the phase's status and dates instead of the overview S10.1.

import Link from 'next/link';
import { currentPhaseOf } from '../domain/phase-plan';
import { phaseDelay, phasesOverview, type PhaseDelay } from '../domain/phase-schedule';
import type { ProjectPhase } from '../application/project-gateway';
import { BackIcon } from './icons';
import { daysAr, phasesTextAr as t, phaseStatusAr } from './messages.ar';
import { phasePath } from './routes';
import styles from './wizard.module.css';

interface Props {
  projectName: string;
  phases: ProjectPhase[];
  /** The date in Libya, "YYYY-MM-DD". */
  today: string;
  homeHref: string;
}

/** "2026-11-09" -> "9 نوفمبر 2026". Noon UTC keeps the day the same in every time zone. */
const dateAr = (iso: string) =>
  new Intl.DateTimeFormat('ar-LY', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Tripoli' }).format(
    new Date(`${iso}T12:00:00Z`),
  );

function delayLabel(d: PhaseDelay): string {
  switch (d.kind) {
    case 'unknown':
      return t.delay.unknown;
    case 'on_time':
      return t.delay.onTime;
    case 'late':
      return d.ongoing ? t.delay.lateNow(daysAr(d.days)) : t.delay.lateDone(daysAr(d.days));
    case 'early':
      return t.delay.early(daysAr(d.days));
  }
}

export function PhasesList({ projectName, phases, today, homeHref }: Props) {
  const overview = phasesOverview(phases, today);
  const current = currentPhaseOf(phases);

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={homeHref} className={styles.iconButton} aria-label={t.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.subtitle}>{t.subtitle(projectName, current?.name ?? null)}</p>
        </div>
      </header>

      <div className={styles.scroll}>
        <div className={styles.summaryCard}>
          <small>{t.doneCard}</small>
          <strong>{t.doneOf(overview.done, overview.total)}</strong>
          <p>{t.lateCount(overview.late)}</p>
        </div>

        <ul className={styles.list} aria-label={t.title}>
          {phases.map((p) => {
            const isCurrent = p.id === current?.id;
            const status = [phaseStatusAr[p.status], isCurrent ? t.current : null].filter(Boolean).join(' · ');
            return (
              <li key={p.id}>
                <Link href={phasePath(p.id)} className={`${styles.listRow} ${styles.rowLink}`}>
                  <span className={styles.rowText}>
                    <strong>{p.name}</strong>
                    <small>{status}</small>
                    <small>{t.planned(p.plannedStart && dateAr(p.plannedStart), p.plannedEnd && dateAr(p.plannedEnd))}</small>
                  </span>
                  <span className={styles.rowValue}>{delayLabel(phaseDelay(p, today))}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        <p className={styles.hint}>{t.note}</p>
      </div>
    </main>
  );
}
