import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DOCUMENTS_PATH, PHOTOS_PATH } from '@/modules/documents';
import { DECISION_PATH } from '@/modules/decisions';
import { CASHFLOW_PATH, RATES_PATH } from '@/modules/finance';
import { PRICES_PATH } from '@/modules/materials';
import { getSignedInUserId, SIGN_IN_PATH, SignOutButton } from '@/modules/identity';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { BottomNav } from '../_shell/BottomNav';
import { morePageTextAr as t } from '../messages.ar';
import styles from './more.module.css';

export const metadata = { title: `${t.pageTitle} · ركيزة` };

// «المزيد»: the screens without a tab of their own (design S07.1's «الفريق والوثائق والتقارير» row and the «المزيد» tab).
// Team and reports are not built yet, so only what exists is listed; materials is shown as coming.
export default async function MorePage() {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  if (!(await getMyProject())) redirect(SETUP_DETAILS_PATH);

  const row = (href: string, title: string, note: string) => (
    <Link href={href} className={`${styles.row} ${styles.link}`}>
      <strong>{title}</strong>
      <small>{note}</small>
    </Link>
  );

  return (
    <>
      <main className={styles.screen}>
        <header className={styles.header}>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.subtitle}>{t.subtitle}</p>
        </header>
        <div className={styles.content}>
          <div className={styles.list}>
            {row(DECISION_PATH, t.decision, t.decisionNote)}
            {row(CASHFLOW_PATH, t.cashflow, t.cashflowNote)}
            {row(PRICES_PATH, t.prices, t.pricesNote)}
            {row(RATES_PATH, t.rates, t.ratesNote)}
            {row(DOCUMENTS_PATH, t.documents, t.documentsNote)}
            {row(PHOTOS_PATH, t.photos, t.photosNote)}
            <div className={`${styles.row} ${styles.disabled}`} aria-disabled="true">
              <strong>{t.materials}</strong>
              <small>{t.materialsNote}</small>
            </div>
          </div>
          <div className={styles.account}>
            <p className={styles.groupTitle}>{t.account}</p>
            <SignOutButton />
          </div>
        </div>
      </main>
      <BottomNav active="more" />
    </>
  );
}
