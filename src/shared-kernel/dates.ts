// Calendar dates (CLAUDE.md data rules): a calendar date is the text "YYYY-MM-DD" (PostgreSQL type date), never
// a JS Date with a hidden time zone. "Today" always means today in Libya (Africa/Tripoli), not on the server.

export const APP_TIME_ZONE = 'Africa/Tripoli';

/** Today's calendar date in Libya, as "YYYY-MM-DD". `now` is a parameter so tests can fix the clock. */
export function todayInTripoli(now: Date = new Date()): string {
  // The en-CA locale writes dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** True for a real calendar date written as "YYYY-MM-DD" ("2026-02-30" is refused). */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
