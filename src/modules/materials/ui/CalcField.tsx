// One number field of a calculator form (design .field), with its hint and error under it. Server Component.

import { calcErrorsAr, calcTextAr } from './messages.ar';
import styles from './materials.module.css';

interface Props {
  name: string;
  label: string;
  value: string;
  error?: keyof typeof calcErrorsAr;
  required?: boolean;
  hint?: string;
}

export function CalcField({ name, label, value, error, required = true, hint }: Props) {
  const describedBy = [error && `${name}-error`, hint && `${name}-hint`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={styles.field}>
      <label htmlFor={name} className={styles.label}>
        {label} {required ? <span aria-hidden="true">*</span> : <small className={styles.optional}>({calcTextAr.optional})</small>}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        inputMode="decimal"
        dir="ltr"
        autoComplete="off"
        className={styles.input}
        defaultValue={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {hint && (
        <p id={`${name}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={`${name}-error`} className={styles.fieldError}>
          {calcErrorsAr[error]}
        </p>
      )}
    </div>
  );
}
