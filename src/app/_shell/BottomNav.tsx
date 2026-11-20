// Bottom navigation (design: «Bottom navigation» on the main screens; brand guideline order from the right:
// الرئيسية، المصروفات، المراحل، المواد، المزيد). In the app layer because it links screens of several modules, and only
// the app may import them all (rule R2). Rendered by each MAIN page; forms (quick expense, new photo, new document,
// the wizard) leave it out so their save button stays at the bottom and the quick expense stays three answers.
// «المواد» opens the materials home since the calculators (3.3 slice 1, 20 Nov 2026).

import Link from 'next/link';
import type { ReactNode } from 'react';
import { EXPENSES_PATH } from '@/modules/finance';
import { MATERIALS_PATH } from '@/modules/materials';
import { PHASES_PATH, PROJECT_HOME_PATH } from '@/modules/projects';
import { bottomNavTextAr as t } from '../messages.ar';
import styles from './bottom-nav.module.css';

export type NavTab = 'home' | 'expenses' | 'phases' | 'materials' | 'more';
export const MORE_PATH = '/more';

/** Lucide icons, the same as the design file (house, wallet, layers, box, ellipsis). */
const ICONS: Record<NavTab, ReactNode> = {
  home: (
    <>
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </>
  ),
  expenses: (
    <>
      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
      <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
    </>
  ),
  phases: (
    <>
      <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" />
      <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" />
      <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" />
    </>
  ),
  materials: (
    <>
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </>
  ),
  more: (
    <>
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </>
  ),
};

const Icon = ({ name }: { name: keyof typeof ICONS }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable={false}>
    {ICONS[name]}
  </svg>
);

const TABS: { tab: NavTab; href: string; label: string }[] = [
  { tab: 'home', href: PROJECT_HOME_PATH, label: t.home },
  { tab: 'expenses', href: EXPENSES_PATH, label: t.expenses },
  { tab: 'phases', href: PHASES_PATH, label: t.phases },
  { tab: 'materials', href: MATERIALS_PATH, label: t.materials },
];

export function BottomNav({ active }: { active: NavTab }) {
  const link = ({ tab, href, label }: { tab: NavTab; href: string; label: string }) => (
    <Link key={tab} href={href} className={styles.item} aria-current={active === tab ? 'page' : undefined}>
      <Icon name={tab} />
      <span>{label}</span>
    </Link>
  );
  return (
    <nav className={styles.nav} aria-label={t.label} data-bottom-nav="">
      {TABS.map(link)}
      {link({ tab: 'more', href: MORE_PATH, label: t.more })}
    </nav>
  );
}
