// Shared helpers for the Habit tracker.
//
// CORRECTNESS NOTE: the community lives in IST. We anchor every "day" to the
// IST civil calendar so a check-in marked at 11pm IST records on the right
// day (the StepEntry/StepEventDetail code mixes UTC and local — do NOT copy
// that here). "Today" is always derived server-side via istTodayYmd().

import { toIstDateString, istTodayYmd } from "@/lib/dates-ist";

export { istTodayYmd };

/** A Date → its IST civil date as "YYYY-MM-DD". */
export function istYmd(d: Date): string {
  return toIstDateString(d);
}

/**
 * "YYYY-MM-DD" → the Date instant for midnight at the start of that IST day.
 * This is the canonical value we store in HabitCheckin.date and query on,
 * so every row for a given civil day collides on the unique constraint.
 */
export function ymdToInstant(ymd: string): Date {
  return new Date(`${ymd}T00:00:00+05:30`);
}

/** Add `n` days (can be negative) to a "YYYY-MM-DD" string, staying in IST. */
export function addDaysYmd(ymd: string, n: number): string {
  // Parse at IST midnight, shift by whole days, reformat in IST.
  const d = ymdToInstant(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return toIstDateString(d);
}

/** Inclusive day count between two YMD strings (a <= b). */
export function daysBetweenYmd(a: string, b: string): number {
  const ms = ymdToInstant(b).getTime() - ymdToInstant(a).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

export interface StreakStats {
  currentStreak: number;
  longestStreak: number;
  /** Days the owner has marked done, total. */
  totalDone: number;
  /** % of elapsed days completed (elapsed = startDate..min(today,endDate)). */
  completionPct: number;
}

/**
 * Compute streaks from sparse check-in dates.
 *
 * - currentStreak: consecutive done-days ending today (or yesterday, if today
 *   isn't marked yet) walking backwards until a gap or the habit's start.
 * - longestStreak: the longest consecutive run anywhere in the history.
 *
 * All math is on IST "YYYY-MM-DD" strings — no Date arithmetic pitfalls.
 */
export function computeStreaks(
  checkinDates: Date[],
  startYmd: string,
  endYmd: string,
  todayYmd: string
): StreakStats {
  const done = new Set(checkinDates.map((d) => istYmd(d)));
  const totalDone = done.size;

  // currentStreak — anchor on today if marked, else yesterday (so a not-yet-
  // marked today doesn't zero an otherwise-live streak).
  let currentStreak = 0;
  let cursor: string | null = null;
  if (done.has(todayYmd)) cursor = todayYmd;
  else {
    const yesterday = addDaysYmd(todayYmd, -1);
    if (done.has(yesterday)) cursor = yesterday;
  }
  while (cursor && done.has(cursor) && cursor >= startYmd) {
    currentStreak++;
    cursor = addDaysYmd(cursor, -1);
  }

  // longestStreak — sort the done days, count consecutive runs.
  let longestStreak = 0;
  const sorted = [...done].sort();
  let run = 0;
  let prev: string | null = null;
  for (const ymd of sorted) {
    if (prev && addDaysYmd(prev, 1) === ymd) run++;
    else run = 1;
    if (run > longestStreak) longestStreak = run;
    prev = ymd;
  }

  // completionPct over ELAPSED days (so a fresh habit isn't stuck near 0%).
  const lastElapsed = todayYmd < endYmd ? todayYmd : endYmd;
  const elapsed =
    lastElapsed >= startYmd ? daysBetweenYmd(startYmd, lastElapsed) : 0;
  const completionPct =
    elapsed > 0 ? Math.round((totalDone / elapsed) * 100) : 0;

  return { currentStreak, longestStreak, totalDone, completionPct };
}

/** Validate a YMD string looks like a real calendar date. */
export function isValidYmd(ymd: unknown): ymd is string {
  if (typeof ymd !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const t = ymdToInstant(ymd).getTime();
  return Number.isFinite(t);
}

/** Max active habits a resident may have (bounds GET payload + abuse). */
export const MAX_ACTIVE_HABITS = 20;

/** Nudge rate-limit window in milliseconds (6 hours). */
export const NUDGE_COOLDOWN_MS = 6 * 60 * 60 * 1000;
