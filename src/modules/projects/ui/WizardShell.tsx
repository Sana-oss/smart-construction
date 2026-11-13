// Frame shared by the four wizard steps: header with a back button, step counter, progress bar, scrollable
// content and the action buttons pinned at the bottom (design S02.1–S02.5).

import Link from 'next/link';
import type { ReactNode } from 'react';
import { BackIcon } from './icons';
import { wizardTextAr as t } from './messages.ar';
import styles from './wizard.module.css';

/** The design has 5 steps; the "project team" step (S02.4) is deferred, so ours has 4 (decision 14 Nov). */
export const WIZARD_STEPS = 4;

export function WizardShell(props: {
  step: number;
  title: string;
  subtitle: string;
  backHref: string;
  children: ReactNode;
  actions: ReactNode;
  showProgress?: boolean;
}) {
  const pct = Math.round((props.step / WIZARD_STEPS) * 100);
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={props.backHref} className={styles.iconButton} aria-label={t.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{props.title}</h1>
          <p className={styles.subtitle}>
            {t.stepOf(props.step, WIZARD_STEPS)} · {props.subtitle}
          </p>
        </div>
      </header>

      <div className={styles.scroll}>
        {props.showProgress !== false && (
          <div>
            <p className={styles.hint}>{t.progress(pct)}</p>
            <div className={styles.progress} aria-hidden="true">
              <i style={{ inlineSize: `${pct}%` }} />
            </div>
          </div>
        )}
        {props.children}
      </div>

      <div className={styles.actions}>{props.actions}</div>
    </main>
  );
}
