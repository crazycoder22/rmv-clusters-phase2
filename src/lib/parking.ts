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

/** Human label for a duration, e.g. "2h 30m". */
export function formatDuration(start: Date, end: Date): string {
  const totalMin = Math.round((end.getTime() - start.getTime()) / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}
