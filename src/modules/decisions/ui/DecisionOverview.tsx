// Continue or pause (design S18.1 «الاستمرار أو التوقف»; FR-DEC-01, 02, 03, 05). Server Component: every number comes
// from the domain (scenarioCosts) and finance's cash outlook; this file only displays them (rule R5).
// The design's rows («مراجعة» on the left) become the three scenarios with their figures; the review is S18.2.

import Link from 'next/link';
import { formatAmount, type Money } from '@/shared-kernel';
import type { ComparisonView } from '../application/comparison';
import { BackIcon } from './icons';
import { decisionTextAr, scenarioName } from './messages.ar';
import { DECISION_INPUTS_PATH, DECISION_REVIEW_PATH } from './routes';
import styles from './decisions.module.css';

const t = decisionTextAr.overview;
const dayMonthAr = (iso: string) =>
  new Intl.DateTimeFormat('ar-LY', { day: 'numeric', month: 'long', timeZone: 'Africa/Tripoli' }).format(new Date(`${iso}T12:00:00Z`));
/** <bdi dir="ltr"> keeps the digits and a minus sign in the right order inside Arabic text. */
const Amount = ({ value }: { value: Money | string }) => <bdi dir="ltr">{formatAmount(value)}</bdi>;

interface Props {
  view: ComparisonView;
  /** Phase names (projects module, through the page). */
  phases: { id: string; name: string }[];
  backHref: string;
  pricesHref: string;
  notice?: 'saved' | 'reviewed' | null;
}

export function DecisionOverview({ view, phases, backHref, pricesHref, notice = null }: Props) {
  const phaseName = phases.find((p) => p.id === view.stored?.inputs.phaseId)?.name ?? null;
  const pct = view.stored?.inputs.priceChangePct ?? '0';
  const hasFigures = view.scenarios.some((s) => s.costNow !== null);
  const { stale, expired } = view.priceWarnings;
  const chosen = view.stored?.review.choice ?? null;

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={backHref} className={styles.iconButton} aria-label={decisionTextAr.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.subtitle}>{t.subtitle}</p>
        </div>
      </header>

      <div className={styles.scroll}>
        {notice && (
          <p role="status" className={styles.info}>
            {notice === 'saved' ? t.saved : t.reviewSaved}
          </p>
        )}

        {/* Design S18.1 summary: «55,000 + 40,000 − 30,000» */}
        <div className={styles.summaryCard}>
          <small>{t.balance}</small>
          <strong>
            {view.base ? (
              <>
                <Amount value={view.base.balanceAtEnd} /> {decisionTextAr.lyd}
              </>
            ) : (
              t.balanceUnknown
            )}
          </strong>
          <p>
            {view.liquidity && view.base ? (
              <bdi dir="ltr">
                {formatAmount(view.liquidity)} + {formatAmount(view.base.income)} − {formatAmount(view.base.obligations)}
              </bdi>
            ) : (
              t.balanceUnknownNote
            )}
          </p>
        </div>

        {(stale.length > 0 || expired.length > 0) && (
          <div role="note" className={styles.info}>
            <strong>{t.priceWarnings}</strong>
            <ul>
              {expired.map((e) => (
                <li key={`e-${e.material}-${e.unit}-${e.expiresOn}`}>{t.expired(e.material, e.unit, dayMonthAr(e.expiresOn))}</li>
              ))}
              {stale.map((s) => (
                <li key={`s-${s.material}-${s.unit}`}>{t.stale(s.material, s.unit, dayMonthAr(s.recordedOn))}</li>
              ))}
            </ul>
            <Link href={pricesHref}>{t.openPrices}</Link>
          </div>
        )}

        {!hasFigures && <p className={styles.errorSummary}>{t.noFigures}</p>}

        <ul className={styles.list} aria-label={t.scenarios}>
          {view.scenarios.map((s) => (
            <li key={s.scenario} className={styles.listRow}>
              <span className={styles.rowText}>
                <strong>{scenarioName(s.scenario, phaseName)}</strong>
                {s.costNow !== null && s.costLater !== null && (
                  <small>{t.nowLater(formatAmount(s.costNow), formatAmount(s.costLater))}</small>
                )}
                {s.outlook &&
                  (s.outlook.shortfall ? (
                    <small>
                      {t.shortfallBefore(dayMonthAr(s.outlook.shortfall.from))} <Amount value={s.outlook.shortfall.lowest} /> {decisionTextAr.lyd}
                    </small>
                  ) : (
                    <small>{t.afterNow(formatAmount(s.outlook.balanceAtEnd))}</small>
                  ))}
                {s.missing.length > 0 && <small>{t.missing(s.missing.map((m) => decisionTextAr.missingInput[m]).join('، '))}</small>}
              </span>
              <span className={styles.rowValue}>
                {s.total !== null ? (
                  <>
                    <Amount value={s.total} /> {decisionTextAr.lyd}
                    <small>{t.total}</small>
                  </>
                ) : (
                  t.incomplete
                )}
              </span>
            </li>
          ))}
        </ul>

        {hasFigures && <p className={styles.hint}>{t.priceChange(pct)}</p>}
        {chosen && <p className={styles.hint}>{t.chosen(scenarioName(chosen, phaseName))}</p>}

        {/* FR-DEC-05: with every result. */}
        <p role="note" className={styles.info}>
          {t.disclaimer} {t.engineer}
        </p>
      </div>

      <div className={styles.actions}>
        <Link href={DECISION_REVIEW_PATH} className={styles.primary}>
          {t.review}
        </Link>
        <Link href={DECISION_INPUTS_PATH} className={styles.secondary}>
          {t.editFigures}
        </Link>
      </div>
    </main>
  );
}
