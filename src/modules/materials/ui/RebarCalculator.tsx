// Rebar calculator (FR-MAT-04; design S22.1 «حاسبة الحديد» and S22.2 «نتيجة وزن الحديد»). Server Component, no saving:
// the form is sent with GET, so the inputs stay in the address and «تعديل المدخلات» brings them back. Every number shown
// comes from the materials domain (calculateRebar); this file only displays it (rule R5).

import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatAmount } from '@/shared-kernel';
import type { RebarCalculatorView } from '../application/calculators';
import type { RebarField, RebarResult } from '../domain/calculators';
import { CalcField } from './CalcField';
import { BackIcon } from './icons';
import { calcTextAr } from './messages.ar';
import { MATERIALS_PATH, REBAR_PATH } from './routes';
import styles from './materials.module.css';

const t = calcTextAr.rebar;
const r = calcTextAr.rebarResult;
const dateAr = (iso: string) =>
  new Intl.DateTimeFormat('ar-LY', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Tripoli' }).format(new Date(`${iso}T12:00:00Z`));

/** The address parameter of each field (short, so the result's address stays readable). */
export const REBAR_PARAMS: Record<RebarField, string> = { diameterMm: 'd', lengthM: 'l', count: 'n', wastePct: 'w', priceLydPerTon: 'p' };

interface Props {
  view: RebarCalculatorView;
  /** What the owner typed, by address parameter. */
  values: Record<string, string>;
  /** true = show the form again with the values («تعديل المدخلات»). */
  editing: boolean;
}

export function RebarCalculator({ view, values, editing }: Props) {
  const calc = view.calculation;
  if (calc?.ok && !editing) return <RebarResultScreen result={calc.value} values={values} />;

  const errors = calc && !calc.ok && 'errors' in calc ? calc.errors : [];
  const errorOf = (f: RebarField) => errors.find((e) => e.field === f)?.code;
  const noCoefficient = !view.coefficient;
  const field = (f: RebarField, label: string, extra: { required?: boolean; hint?: string } = {}) => (
    <CalcField name={REBAR_PARAMS[f]} label={label} value={values[REBAR_PARAMS[f]] ?? ''} error={errorOf(f)} {...extra} />
  );

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
        <form id="rebar-form" method="get" action={REBAR_PATH} noValidate>
          {noCoefficient && (
            <p role="alert" className={styles.errorSummary}>
              {t.noCoefficient}
            </p>
          )}
          <p className={styles.info}>{t.source}</p>
          <p className={styles.hint}>{calcTextAr.requiredHint}</p>
          {field('diameterMm', t.diameter)}
          {field('lengthM', t.length)}
          {field('count', t.count)}
          {field('wastePct', t.waste, { required: false, hint: t.wasteHint })}
          {field('priceLydPerTon', t.price, { required: false, hint: t.priceHint })}
          <p className={styles.hint}>{t.scope}</p>
        </form>
      </div>

      <div className={styles.actions}>
        <button type="submit" form="rebar-form" className={styles.primary}>
          {t.submit}
        </button>
      </div>
    </main>
  );
}

function RebarResultScreen({ result, values }: { result: RebarResult; values: Record<string, string> }) {
  const editHref = `${REBAR_PATH}?${new URLSearchParams({ ...values, edit: '1' }).toString()}`;
  const c = result.coefficient;
  const row = (title: string, note: string, value: ReactNode) => (
    <li className={styles.listRow}>
      <span className={styles.rowText}>
        <strong>{title}</strong>
        <small>{note}</small>
      </span>
      <span className={styles.rowValue}>{value}</span>
    </li>
  );
  const unit = (v: Parameters<typeof formatAmount>[0], label: string) => (
    <>
      <bdi dir="ltr">{formatAmount(v)}</bdi> {label}
    </>
  );
  const reviewNote = c.status === 'approved' && c.reviewedBy && c.reviewedOn ? r.reviewed(c.reviewedBy, dateAr(c.reviewedOn)) : r.unreviewed;

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={editHref} className={styles.iconButton} aria-label={calcTextAr.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{r.title}</h1>
          <p className={styles.subtitle}>{r.subtitle(formatAmount(result.diameterMm), formatAmount(result.lengthM), formatAmount(result.count))}</p>
        </div>
      </header>

      <div className={styles.scroll}>
        <div className={styles.summaryCard}>
          <small>{result.wastePct ? `${r.weight} · ${r.withWaste(formatAmount(result.wastePct))}` : r.weight}</small>
          <strong>{unit(result.totalWithWasteKg, r.kg)}</strong>
          <p>{r.tons(formatAmount(result.totalWithWasteTons))}</p>
        </div>

        <ul className={styles.list} aria-label={r.title}>
          {row(r.bar, r.approximate, unit(result.barKg, r.kg))}
          {row(r.totalLength, r.lengthNote(formatAmount(result.count), formatAmount(result.lengthM)), unit(result.totalLengthM, r.meters))}
          {result.wastePct && row(r.withoutWaste, r.approximate, unit(result.totalKg, r.kg))}
          {result.costLyd && result.priceLydPerTon && row(r.cost, r.costNote(formatAmount(result.priceLydPerTon)), unit(result.costLyd, calcTextAr.lyd))}
          {row(r.formula, r.formulaValue(formatAmount(c.divisor)), c.status === 'approved' ? r.approvedShort : r.unreviewedShort)}
        </ul>
        <p className={styles.info}>{reviewNote}</p>
        <p className={styles.hint}>{r.disclaimer}</p>
      </div>

      <div className={styles.actions}>
        <Link href={editHref} className={styles.primary}>
          {r.edit}
        </Link>
        <Link href={MATERIALS_PATH} className={styles.secondary}>
          {r.backToMaterials}
        </Link>
      </div>
    </main>
  );
}
