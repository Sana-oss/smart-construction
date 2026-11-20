// Materials home (design S20.1 «المواد والكميات»; 3.3 slice 1). For now: the calculators and the price log. The
// quantity table and purchases (the design's «بنود المواد» and «تسجيل شراء») are slice 2. Server Component.

import Link from 'next/link';
import { calcTextAr } from './messages.ar';
import { CALCULATORS_PATH, PRICES_PATH, REBAR_PATH } from './routes';
import styles from './materials.module.css';

const t = calcTextAr.home;

export function MaterialsHome() {
  const link = (href: string, title: string, note: string) => (
    <Link href={href} className={styles.quickLink}>
      <span className={styles.rowText}>
        <strong>{title}</strong>
        <small>{note}</small>
      </span>
    </Link>
  );
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.subtitle}>{t.subtitle}</p>
        </div>
      </header>
      <div className={styles.scroll}>
        <nav className={styles.quickLinks} aria-label={t.linksLabel}>
          {link(REBAR_PATH, t.rebar, t.rebarNote)}
          {link(CALCULATORS_PATH, t.others, t.othersNote)}
          {link(PRICES_PATH, t.prices, t.pricesNote)}
        </nav>
        <p className={styles.hint}>{t.quantitiesSoon}</p>
      </div>
    </main>
  );
}
