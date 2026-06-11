// Shared helpers for the parking-slot-sharing feature.
// Pricing is hourly; billing = rate × exact hours (rounded to 2 dp).

export const MIN_BOOKING_MINUTES = 30;
export const MAX_BOOKING_HOURS = 24;
export const START_GRACE_MINUTES = 5; // allow "start" up to 5 min in the past (clock skew)
export const MAX_RATE = 1000; // ₹/hr sanity ceiling

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Exact duration in hours between two instants. */
export function hoursBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / 3_600_000;
}

/** Total price for a window at a given hourly rate, rounded to 2 dp. */
export function computePrice(hourlyRate: number, start: Date, end: Date): number {
  return round2(hourlyRate * hoursBetween(start, end));
}

/** Two half-open intervals [aStart,aEnd) and [bStart,bEnd) overlap. */
export function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

export interface WindowResult {
  ok: boolean;
  start?: Date;
  end?: Date;
  error?: string;
}

/**
 * Parse + validate a requested booking window.
 * `now` is injected so callers control the clock (and tests are deterministic).
 */
export function validateWindow(startInput: unknown, endInput: unknown, now: Date): WindowResult {
  if (typeof startInput !== "string" || typeof endInput !== "string") {
    return { ok: false, error: "Start and end times are required" };
  }
  const start = new Date(startInput);
  const end = new Date(endInput);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { ok: false, error: "Invalid start or end time" };
  }
  if (end.getTime() <= start.getTime()) {
    return { ok: false, error: "End time must be after the start time" };
  }
  const durationMin = (end.getTime() - start.getTime()) / 60_000;
  if (durationMin < MIN_BOOKING_MINUTES) {
    return { ok: false, error: `Minimum booking is ${MIN_BOOKING_MINUTES} minutes` };
  }
  if (durationMin > MAX_BOOKING_HOURS * 60) {
    return { ok: false, error: `Maximum booking is ${MAX_BOOKING_HOURS} hours` };
  }
  if (start.getTime() < now.getTime() - START_GRACE_MINUTES * 60_000) {
    return { ok: false, error: "Start time can't be in the past" };
  }
  return { ok: true, start, end };
}

/** Validate an hourly rate on slot create/edit. */
export function validateRate(raw: unknown): { ok: boolean; rate?: number; error?: string } {
  const rate = typeof raw === "number" ? raw : parseFloat(String(raw));
  if (isNaN(rate) || rate < 0) return { ok: false, error: "Enter a valid hourly rate" };
  if (rate > MAX_RATE) return { ok: false, error: `Hourly rate can't exceed ₹${MAX_RATE}` };
  return { ok: true, rate: round2(rate) };
}

// ── Monthly rentals ──────────────────────────────────────────────────────────

// Open-ended monthly bookings store this far-future endAt so the existing
// half-open overlap query keeps blocking everything from the start date on.
export const SENTINEL_END = new Date("9999-12-31T00:00:00.000Z");
export const MAX_MONTHS = 36; // cap on a fixed-term monthly booking
export const MAX_MONTHLY_RATE = 100000; // ₹/month sanity ceiling

export function isOpenEnded(end: Date): boolean {
  return end.getTime() === SENTINEL_END.getTime();
}

/** Validate a monthly rate on slot create/edit (optional add-on). */
export function validateMonthlyRate(raw: unknown): { ok: boolean; rate?: number; error?: string } {
  const rate = typeof raw === "number" ? raw : parseFloat(String(raw));
  if (isNaN(rate) || rate <= 0) return { ok: false, error: "Enter a valid monthly rate" };
  if (rate > MAX_MONTHLY_RATE) return { ok: false, error: `Monthly rate can't exceed ₹${MAX_MONTHLY_RATE}` };
  return { ok: true, rate: round2(rate) };
}

/**
 * Whole months between two civil dates, rounded up (offline/informational).
 * Matches: Jun 5 → Jul 20 = 2 months; Jul 1 → Jul 31 = 1 month.
 */
export function monthsCeilYmd(startYmd: string, endYmd: string): number {
  const [sy, sm, sd] = startYmd.split("-").map(Number);
  const [ey, em, ed] = endYmd.split("-").map(Number);
  let months = (ey - sy) * 12 + (em - sm);
  if (ed >= sd) months += 1;
  return Math.max(1, months);
}

export interface MonthlyWindowResult {
  ok: boolean;
  startYmd?: string;
  endYmd?: string | null;
  start?: Date;
  end?: Date;
  openEnded?: boolean;
  error?: string;
}

/**
 * Parse + validate a monthly booking window. `startInput` is a "YYYY-MM-DD"
 * date; `endInput` is an optional "YYYY-MM-DD" (omit/empty → open-ended).
 * IST instants: start = midnight of the start date; end = midnight of the day
 * AFTER endYmd (half-open, so the end date is inclusive) or SENTINEL_END.
 */
export function validateMonthlyWindow(
  startInput: unknown,
  endInput: unknown,
  now: Date
): MonthlyWindowResult {
  if (!isYmd(startInput)) return { ok: false, error: "Pick a start date" };
  const startYmd = startInput;
  const start = istMidnight(startYmd);
  if (start.getTime() < istMidnight(toIstYmd(now)).getTime()) {
    return { ok: false, error: "Start date can't be in the past" };
  }

  const hasEnd = typeof endInput === "string" && endInput.trim() !== "";
  if (!hasEnd) {
    return { ok: true, startYmd, endYmd: null, start, end: SENTINEL_END, openEnded: true };
  }
  if (!isYmd(endInput)) return { ok: false, error: "Invalid end date" };
  const endYmd = endInput;
  if (istMidnight(endYmd).getTime() < start.getTime()) {
    return { ok: false, error: "End date must be on or after the start date" };
  }
  if (monthsCeilYmd(startYmd, endYmd) > MAX_MONTHS) {
    return { ok: false, error: `A monthly booking can't exceed ${MAX_MONTHS} months` };
  }
  // Inclusive end date → half-open instant is midnight of the next day.
  const end = new Date(istMidnight(endYmd).getTime() + 24 * 3_600_000);
  return { ok: true, startYmd, endYmd, start, end, openEnded: false };
}

/** Total for a monthly booking (informational; billing is offline). */
export function computeMonthlyTotal(
  monthlyRate: number,
  startYmd: string,
  endYmd: string | null
): number {
  if (!endYmd) return round2(monthlyRate); // open-ended → one month shown
  return round2(monthlyRate * monthsCeilYmd(startYmd, endYmd));
}

// "YYYY-MM-DD" → midnight IST instant (mirrors src/lib/habits ymdToInstant).
function istMidnight(s: string): Date {
  return new Date(`${s}T00:00:00+05:30`);
}
function isYmd(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}
function toIstYmd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Human label for a duration, e.g. "2h 30m". */
export function formatDuration(start: Date, end: Date): string {
  const totalMin = Math.round((end.getTime() - start.getTime()) / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}
