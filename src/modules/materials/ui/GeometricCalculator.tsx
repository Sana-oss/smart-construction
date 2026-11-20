// One geometric calculator (FR-MAT-05; design S23.2 «حجم الخرسانة», and the same screen for the finish area and the
// tile count). Server Component, no saving: the form is sent with GET and the result shows above the inputs, as in the
// design. The result comes from the materials domain (runGeometricCalculator); this file only displays it (rule R5).

import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatAmount } from '@/shared-kernel';
import { GEOMETRIC_FIELDS, type GeometricCalculation, type GeometricKind } from '../application/calculators';
import { CalcField } from './CalcField';
import { BackIcon } from './icons';
import { calcTextAr } from './messages.ar';
import { CALCULATORS_PATH, calculatorPath } from './routes';
import styles from './materials.module.css';

const g = calcTextAr.geometric;

interface Props {
  kind: GeometricKind;
  /** What the owner typed, by field name. */
  values: Record<string, string>;
  /** null = nothing submitted yet. */
  calculation: GeometricCalculation | null;
}

export function GeometricCalculator({ kind, values, calculation }: Props) {
  const text = g[kind];
  const fields = GEOMETRIC_FIELDS[kind];
  const errors = calculation && !calculation.ok ? calculation.errors : [];
  const formId = `calc-${kind}`;

  let result: { value: string; note: ReactNode } | null = null;
  if (calculation?.ok) {
    const v = calculation.value;
    const inputs = calculation.inputs.map((n) => formatAmount(n));
    // The calculation reads left to right («10 × 8 × 0.15»), as in the design, inside the RTL page.
    const shown = (
      <>
        <bdi dir="ltr">{inputs.join(' × ')}</bdi> · {g.noAdditions}
      </>
    );
    if (kind === 'concrete') result = { value: formatAmount(v.volumeM3!), note: shown };
    else if (kind === 'area') result = { value: formatAmount(v.areaM2!), note: shown };
    else result = { value: formatAmount(v.count!), note: g.tilesNote(formatAmount(v.tileAreaM2!)) };
  }

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={CALCULATORS_PATH} className={styles.iconButton} aria-label={calcTextAr.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{text.title}</h1>
          <p className={styles.subtitle}>{g.subtitle}</p>
        </div>
      </header>

      <div className={styles.scroll}>
        {result && (
          <div className={styles.summaryCard} role="status">
            <small>{text.resultLabel}</small>
            <strong>
              <bdi dir="ltr">{result.value}</bdi> {text.unit}
            </strong>
            <p>{result.note}</p>
          </div>
        )}
        <form id={formId} method="get" action={calculatorPath(kind)} noValidate>
          <p className={styles.hint}>{text.formula}</p>
          {fields.map((f) => (
            <CalcField key={f} name={f} label={g.fields[f]} value={values[f] ?? ''} error={errors.find((e) => e.field === f)?.code} />
          ))}
          <p className={styles.hint}>{g.disclaimer}</p>
        </form>
      </div>

      <div className={styles.actions}>
        <button type="submit" form={formId} className={styles.primary}>
          {g.submit}
        </button>
        <Link href={CALCULATORS_PATH} className={styles.secondary}>
          {g.backToCalculators}
        </Link>
      </div>
    </main>
  );
}
