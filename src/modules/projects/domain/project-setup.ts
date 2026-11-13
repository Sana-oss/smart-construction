import { money, parseDecimalInput, type Money } from '@/shared-kernel';
import { LIBYA_DISTRICTS, OTHER_CITY } from './libya-districts';

// Rules for the first-project wizard (FR-PRJ-01, FR-PRJ-02, FR-FIN-01; decisions of 14 Nov 2026).
// Pure: no React, Next or Supabase (rule R4). Money stays Decimal, never a JS number.

export type ProjectType = 'new' | 'add_floor';
export const PROJECT_TYPES: readonly ProjectType[] = ['new', 'add_floor'];

export const NAME_MIN = 2;
export const NAME_MAX = 80;
export const OTHER_CITY_MIN = 2;
export const OTHER_CITY_MAX = 60;
/** Project default shown on the budget step, editable. NOT an engineering or financial standard (decision 11). */
export const DEFAULT_CONTINGENCY_PCT = '10';

export type SetupField =
  | 'name'
  | 'city'
  | 'otherCity'
  | 'projectType'
  | 'buildingArea'
  | 'totalBudget'
  | 'availableNow'
  | 'spentBefore'
  | 'contingencyPct'
  | 'currentPhase';

export type SetupErrorCode =
  | 'required'
  | 'too_short'
  | 'too_long'
  | 'invalid_number'
  | 'must_be_positive'
  | 'percent_out_of_range'
  | 'too_large'
  | 'unknown_choice';

export interface SetupError {
  field: SetupField;
  code: SetupErrorCode;
}

type Result<T> = { ok: true; value: T } | { ok: false; errors: SetupError[] };

// ---------- Step 1: project details (S02.1) ----------

export interface ProjectDetailsInput {
  name?: string | null;
  /** One of LIBYA_DISTRICTS, or OTHER_CITY. */
  city?: string | null;
  /** Free text, used only when city = OTHER_CITY. */
  otherCity?: string | null;
  projectType?: string | null;
  /** Total built area of all floors, m² (add a floor: the new floor only). Decision 14. */
  buildingArea?: string | null;
}

export interface ProjectDetails {
  name: string;
  city: string;
  projectType: ProjectType;
  /** Canonical decimal string, > 0, at most 2 decimals. */
  buildingAreaM2: string;
}

const clean = (s: string | null | undefined) => (s ?? '').trim().replace(/\s+/g, ' ');

function checkLength(field: SetupField, value: string, min: number, max: number, errors: SetupError[]) {
  if (value === '') errors.push({ field, code: 'required' });
  else if ([...value].length < min) errors.push({ field, code: 'too_short' });
  else if ([...value].length > max) errors.push({ field, code: 'too_long' });
}

export function validateProjectDetails(input: ProjectDetailsInput): Result<ProjectDetails> {
  const errors: SetupError[] = [];

  const name = clean(input.name);
  checkLength('name', name, NAME_MIN, NAME_MAX, errors);

  let city = '';
  const choice = clean(input.city);
  if (choice === '') errors.push({ field: 'city', code: 'required' });
  else if (choice === OTHER_CITY) {
    city = clean(input.otherCity);
    checkLength('otherCity', city, OTHER_CITY_MIN, OTHER_CITY_MAX, errors);
  } else if ((LIBYA_DISTRICTS as readonly string[]).includes(choice)) city = choice;
  else errors.push({ field: 'city', code: 'unknown_choice' });

  const type = clean(input.projectType);
  if (type === '') errors.push({ field: 'projectType', code: 'required' });
  else if (!(PROJECT_TYPES as readonly string[]).includes(type)) errors.push({ field: 'projectType', code: 'unknown_choice' });

  let area = '';
  if (clean(input.buildingArea) === '') errors.push({ field: 'buildingArea', code: 'required' });
  else {
    const parsed = parseDecimalInput(input.buildingArea);
    if (parsed === null || !/^\d+(\.\d{1,2})?$/.test(parsed)) errors.push({ field: 'buildingArea', code: 'invalid_number' });
    else if (money(parsed).lte(0)) errors.push({ field: 'buildingArea', code: 'must_be_positive' });
    else area = parsed;
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { name, city, projectType: type as ProjectType, buildingAreaM2: area } };
}

// ---------- Step 3: budget (S02.3) ----------

export interface BudgetInput {
  totalBudget?: string | null;
  availableNow?: string | null;
  spentBefore?: string | null;
  contingencyPct?: string | null;
}

export interface BudgetSetup {
  totalBudget: Money;
  availableNow: Money;
  spentBefore: Money;
  contingencyPct: Money;
  /**
   * Spent before the app is more than the total budget. NOT an error (decision D2 / 7): the owner sees a warning,
   * confirms, and the confirmation is logged.
   */
  overBudget: boolean;
}

function readMoney(field: SetupField, raw: string | null | undefined, errors: SetupError[]): Money | null {
  if (clean(raw) === '') {
    errors.push({ field, code: 'required' });
    return null;
  }
  const parsed = parseDecimalInput(raw);
  if (parsed === null) {
    errors.push({ field, code: 'invalid_number' });
    return null;
  }
  // The database stores money as numeric(14,3): at most 11 digits before the decimal point.
  if (parsed.split('.')[0].length > 11) {
    errors.push({ field, code: 'too_large' });
    return null;
  }
  return money(parsed);
}

export function validateBudget(input: BudgetInput): Result<BudgetSetup> {
  const errors: SetupError[] = [];
  const totalBudget = readMoney('totalBudget', input.totalBudget, errors);
  if (totalBudget?.lte(0)) errors.push({ field: 'totalBudget', code: 'must_be_positive' });
  const availableNow = readMoney('availableNow', input.availableNow, errors);
  const spentBefore = readMoney('spentBefore', input.spentBefore, errors);
  const contingencyPct = readMoney('contingencyPct', input.contingencyPct, errors);
  // numeric(5,2) in the database: 0–100 with at most 2 decimals.
  if (contingencyPct && (contingencyPct.gt(100) || contingencyPct.decimalPlaces() > 2)) {
    errors.push({ field: 'contingencyPct', code: 'percent_out_of_range' });
  }

  if (errors.length > 0 || !totalBudget || !availableNow || !spentBefore || !contingencyPct) return { ok: false, errors };
  return {
    ok: true,
    value: { totalBudget, availableNow, spentBefore, contingencyPct, overBudget: spentBefore.gt(totalBudget) },
  };
}
