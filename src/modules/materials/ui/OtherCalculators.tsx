// Other calculators (FR-MAT-05; design S23.1 «الحاسبات الأخرى»): concrete volume, finish area, tile count. Geometry only.
// Brick, cement and sand need mix ratios that the engineer has not approved, so they are not offered (CLAUDE.md:
// engineering numbers are never invented). Server Component.

import Link from 'next/link';
import { GEOMETRIC_KINDS } from '../application/calculators';
import { BackIcon } from './icons';
import { calcTextAr } from './messages.ar';
import { calculatorPath, MATERIALS_PATH } from './routes';
import styles from './materials.module.css';

const t = calcTextAr.others;
const g = calcTextAr.geometric;

export function OtherCalculators() {
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={MATERIALS_PATH} className={styles.iconButton} aria-label={calcTextAr.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.subtitle}>{t.subtitle}</p>
        </div>
      </header>
      <div className={styles.scroll}>
        <nav className={styles.quickLinks} aria-label={t.title}>
          {GEOMETRIC_KINDS.map((kind) => (
            <Link key={kind} href={calculatorPath(kind)} className={styles.quickLink} aria-label={t.open(g[kind].title)}>
              <span className={styles.rowText}>
                <strong>{g[kind].title}</strong>
                <small>{g[kind].formula}</small>
              </span>
              <span className={styles.tag}>{g[kind].unit}</span>
            </Link>
          ))}
        </nav>
        <p className={styles.hint}>{t.review}</p>
        <p className={styles.hint}>{t.notYet}</p>
      </div>
    </main>
  );
}
