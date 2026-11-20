import { isIsoDate } from '@/shared-kernel';
import type { PhaseStatus } from './phase-plan';

// Phase dates, status and delay (FR-PRJ-03: "التأخير = الفرق بين المخطط والفعلي؛ حالة غير صالحة تُرفض؛ لا Gantt").
// Pure: no React, no database. All dates are calendar dates "YYYY-MM-DD"; "today" is the date in Libya.

export const PHASE_STATUSES: readonly PhaseStatus[] = ['not_started', 'in_progress', 'closing', 'done', 'blocked'];

export interface PhaseSchedule {
  status: PhaseStatus;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
}

/** Whole days from `from` to `to` (positive when `to` is later). Both "YYYY-MM-DD". */
export function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

export type PhaseDelay =
  /** No planned date to compare with. */
  | { kind: 'unknown' }
  | { kind: 'on_time'; basis: 'start' | 'finish' | 'plan' }
  /**
   * Late by `days`. ongoing = still running late today (the planned date passed and the actual one is not set);
   * otherwise it is the final difference between two dates that are both set.
   */
  | { kind: 'late'; days: number; basis: 'start' | 'finish'; ongoing: boolean }
  | { kind: 'early'; days: number; basis: 'start' | 'finish' };

const compare = (days: number, basis: 'start' | 'finish'): PhaseDelay =>
  days > 0 ? { kind: 'late', days, basis, ongoing: false } : days < 0 ? { kind: 'early', days: -days, basis } : { kind: 'on_time', basis };

/**
 * The phase's delay: the difference between planned and actual dates (FR-PRJ-03). The finish counts before the
 * start, because a late finish is what the owner pays for. In order:
 *   1. both ends known                         -> actual end - planned end
 *   2. planned end passed, phase not finished  -> today - planned end (still running late)
 *   3. both starts known                       -> actual start - planned start
 *   4. planned start passed, phase not started -> today - planned start (still running late)
 *   5. a planned date exists, nothing is late  -> on time; no planned date at all -> unknown
 * "Not finished" = no actual end and status not 'done' (a phase marked done in the wizard has no dates).
 */
export function phaseDelay(p: PhaseSchedule, today: string): PhaseDelay {
  if (p.plannedEnd && p.actualEnd) return compare(daysBetween(p.plannedEnd, p.actualEnd), 'finish');
  if (p.plannedEnd && !p.actualEnd && p.status !== 'done' && daysBetween(p.plannedEnd, today) > 0) {
    return { kind: 'late', days: daysBetween(p.plannedEnd, today), basis: 'finish', ongoing: true };
  }
  if (p.plannedStart && p.actualStart) return compare(daysBetween(p.plannedStart, p.actualStart), 'start');
  if (p.plannedStart && !p.actualStart && p.status === 'not_started' && daysBetween(p.plannedStart, today) > 0) {
    return { kind: 'late', days: daysBetween(p.plannedStart, today), basis: 'start', ongoing: true };
  }
  return p.plannedStart || p.plannedEnd ? { kind: 'on_time', basis: 'plan' } : { kind: 'unknown' };
}

// ---------------------------------------------------------------------------------------------------------------
// Editing a phase's status and dates. The server checks again (and the database's constraints check a third time).

export type PhaseScheduleField = 'status' | 'plannedStart' | 'plannedEnd' | 'actualStart' | 'actualEnd';
export type PhaseScheduleErrorCode = 'unknown_status' | 'invalid_date' | 'end_before_start' | 'date_in_future';
export interface PhaseScheduleError {
  field: PhaseScheduleField;
  code: PhaseScheduleErrorCode;
}

export interface PhaseScheduleInput {
  status?: string | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  actualStart?: string | null;
  actualEnd?: string | null;
}

export type PhaseScheduleResult = { ok: true; value: PhaseSchedule } | { ok: false; errors: PhaseScheduleError[] };

const isPhaseStatus = (v: unknown): v is PhaseStatus => (PHASE_STATUSES as readonly unknown[]).includes(v);

/**
 * Rules: a known status; each date empty or a real calendar date; an end not before its start; actual dates not
 * after today (they record what happened). Planned dates may be in the future, of course.
 * Not a rule (D2, and work overlaps on site): the status and the dates may disagree, e.g. "in progress" with no
 * actual start. The owner keeps what they know.
 */
export function validatePhaseSchedule(input: PhaseScheduleInput, today: string): PhaseScheduleResult {
  const errors: PhaseScheduleError[] = [];
  const date = (field: Exclude<PhaseScheduleField, 'status'>): string | null => {
    const raw = (input[field] ?? '').trim();
    if (raw === '') return null;
    if (!isIsoDate(raw)) {
      errors.push({ field, code: 'invalid_date' });
      return null;
    }
    return raw;
  };

  const status = input.status;
  if (!isPhaseStatus(status)) errors.push({ field: 'status', code: 'unknown_status' });
  const plannedStart = date('plannedStart');
  const plannedEnd = date('plannedEnd');
  const actualStart = date('actualStart');
  const actualEnd = date('actualEnd');

  if (plannedStart && plannedEnd && daysBetween(plannedStart, plannedEnd) < 0) {
    errors.push({ field: 'plannedEnd', code: 'end_before_start' });
  }
  if (actualStart && daysBetween(actualStart, today) < 0) errors.push({ field: 'actualStart', code: 'date_in_future' });
  if (actualEnd && daysBetween(actualEnd, today) < 0) errors.push({ field: 'actualEnd', code: 'date_in_future' });
  if (actualStart && actualEnd && daysBetween(actualStart, actualEnd) < 0) {
    errors.push({ field: 'actualEnd', code: 'end_before_start' });
  }

  if (errors.length > 0 || !isPhaseStatus(status)) return { ok: false, errors };
  return { ok: true, value: { status, plannedStart, plannedEnd, actualStart, actualEnd } };
}

// ---------------------------------------------------------------------------------------------------------------
// Summary card of the phases screen (S09.1). The design's «التقدم العام 38%» needs tasks (FR-PRJ-04) and an
// agreed formula, so until then the card shows counts only.

export interface PhasesOverview {
  total: number;
  done: number;
  /** Phases late today or finished late (phaseDelay kind 'late'). */
  late: number;
}

export function phasesOverview(phases: readonly PhaseSchedule[], today: string): PhasesOverview {
  return {
    total: phases.length,
    done: phases.filter((p) => p.status === 'done').length,
    late: phases.filter((p) => phaseDelay(p, today).kind === 'late').length,
  };
}

/**
 * FR-PRJ-05: starting a phase is moving it from «لم تبدأ» to «قيد التنفيذ». This is where the readiness gate warns (the
 * gate itself is composed by the app: projects does not know the readiness list, which belongs to quality).
 */
export function isPhaseStart(oldStatus: PhaseStatus, newStatus: PhaseStatus): boolean {
  return oldStatus === 'not_started' && newStatus === 'in_progress';
}

/**
 * FR-QLT-07: finishing a phase is moving it to «مكتملة» from any other state. This is where open defects warn (the
 * warning itself is composed by the app: the defects belong to quality).
 */
export function isPhaseClose(oldStatus: PhaseStatus, newStatus: PhaseStatus): boolean {
  return newStatus === 'done' && oldStatus !== 'done';
}
