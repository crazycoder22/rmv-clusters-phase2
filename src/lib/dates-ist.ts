/**
 * IST date helpers used by the VisitLog import script and API routes.
 * Keeps "today" semantics consistent across scripts and server code.
 */

const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Convert any Date to its IST calendar date as `YYYY-MM-DD` */
export function toIstDateString(d: Date): string {
  return fmt.format(d); // en-CA emits ISO-like "2026-04-10"
}

/** Today's date in IST as `YYYY-MM-DD` */
export function istTodayYmd(): string {
  return toIstDateString(new Date());
}

/** Date N days ago in IST as `YYYY-MM-DD` (inclusive of today when N=0) */
export function istYmdDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return toIstDateString(d);
}

/**
 * Parse MyGate's "10-Apr-2026 09:52:47 PM" into a Date (interpreted as IST).
 * Returns null for empty/invalid input.
 */
export function parseMyGateIstDateTime(raw: string): Date | null {
  if (!raw || !raw.trim()) return null;
  // Format: "DD-MMM-YYYY HH:MM:SS AM/PM"
  const m = raw
    .trim()
    .match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const monStr = m[2].toLowerCase();
  const year = parseInt(m[3], 10);
  let hour = parseInt(m[4], 10);
  const minute = parseInt(m[5], 10);
  const second = m[6] ? parseInt(m[6], 10) : 0;
  const meridiem = m[7].toUpperCase();
  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const month = months[monStr];
  if (month === undefined) return null;
  if (meridiem === "PM" && hour !== 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  // Convert IST (UTC+5:30) → UTC
  return new Date(Date.UTC(year, month, day, hour - 5, minute - 30, second));
}
