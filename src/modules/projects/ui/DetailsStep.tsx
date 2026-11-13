'use client';

// Step 1 of the first-project wizard: project details (FR-PRJ-01, FR-PRJ-02). Design: S02.1.
// Changes from the design, decided 14 Nov: city is a list of Libya's districts + "other"; project type is a choice
// (new / add a floor) instead of free text; the area field explains what to measure.

import { useRouter } from 'next/navigation';
import { useState, type InputHTMLAttributes } from 'react';
import { LIBYA_DISTRICTS, OTHER_CITY } from '../domain/libya-districts';
import { validateProjectDetails, type SetupField } from '../domain/project-setup';
import { toFieldErrors } from './field-errors';
import { wizardTextAr } from './messages.ar';
import { PROJECT_HOME_PATH, SETUP_PHASES_PATH } from './routes';
import { useWizardDraft } from './use-wizard-draft';
import { WizardShell } from './WizardShell';
import styles from './wizard.module.css';

const t = wizardTextAr.details;

export function DetailsStep() {
  const router = useRouter();
  const { draft, update } = useWizardDraft();
  const [errors, setErrors] = useState<Partial<Record<SetupField, string>>>({});
  if (!draft) return null;

  const next = () => {
    const r = validateProjectDetails(draft);
    if (!r.ok) {
      setErrors(toFieldErrors(r.errors));
      return;
    }
    router.push(SETUP_PHASES_PATH);
  };

  const input = (name: 'name' | 'otherCity' | 'buildingArea', label: string, props: InputHTMLAttributes<HTMLInputElement>, helper?: string) => (
    <div className={styles.field}>
      <label htmlFor={name} className={styles.label}>
        {label} <span aria-hidden="true">*</span>
      </label>
      <input
        id={name}
        className={styles.input}
        value={draft[name] ?? ''}
        onChange={(e) => update({ [name]: e.target.value })}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={[errors[name] ? `${name}-error` : '', helper ? `${name}-helper` : ''].filter(Boolean).join(' ') || undefined}
        required
        {...props}
      />
      {helper && (
        <p id={`${name}-helper`} className={styles.helper}>
          {helper}
        </p>
      )}
      {errors[name] && (
        <p id={`${name}-error`} className={styles.fieldError}>
          {errors[name]}
        </p>
      )}
    </div>
  );

  return (
    <WizardShell
      step={1}
      title={t.title}
      subtitle={t.subtitle}
      backHref={PROJECT_HOME_PATH}
      actions={
        <button type="button" className={styles.primary} onClick={next}>
          {t.next}
        </button>
      }
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          next();
        }}
      >
        <p className={styles.hint}>{wizardTextAr.requiredHint}</p>

        {input('name', t.name, { type: 'text', autoComplete: 'off' })}

        <div className={styles.field}>
          <label htmlFor="city" className={styles.label}>
            {t.city} <span aria-hidden="true">*</span>
          </label>
          <select
            id="city"
            className={styles.input}
            value={draft.city ?? ''}
            onChange={(e) => update({ city: e.target.value })}
            aria-invalid={errors.city ? true : undefined}
            aria-describedby={errors.city ? 'city-error' : undefined}
            required
          >
            <option value="" disabled>
              {t.cityPlaceholder}
            </option>
            {LIBYA_DISTRICTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
            <option value={OTHER_CITY}>{t.cityOther}</option>
          </select>
          {errors.city && (
            <p id="city-error" className={styles.fieldError}>
              {errors.city}
            </p>
          )}
        </div>

        {draft.city === OTHER_CITY && input('otherCity', t.otherCity, { type: 'text', autoComplete: 'address-level2' })}

        <fieldset className={styles.choiceGroup} aria-describedby={errors.projectType ? 'projectType-error' : undefined}>
          <legend className={styles.label}>
            {t.projectType} <span aria-hidden="true">*</span>
          </legend>
          <div className={styles.choices}>
            {(
              [
                ['new', t.typeNew],
                ['add_floor', t.typeAddFloor],
              ] as const
            ).map(([value, text]) => (
              <label key={value} className={styles.choice}>
                <input
                  type="radio"
                  name="projectType"
                  value={value}
                  checked={draft.projectType === value}
                  onChange={() => update({ projectType: value })}
                />
                {text}
              </label>
            ))}
          </div>
          {errors.projectType && (
            <p id="projectType-error" className={styles.fieldError}>
              {errors.projectType}
            </p>
          )}
        </fieldset>

        {input('buildingArea', t.area, { type: 'text', inputMode: 'decimal', dir: 'ltr' }, t.areaHelper)}
      </form>
    </WizardShell>
  );
}
