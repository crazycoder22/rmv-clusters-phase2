import { isAdmin, hasExactRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

// Roles allowed to manage amenities + approve bookings.
export const MANAGER_ROLES = [
  "ADMIN",
  "SUPERADMIN",
  "COMMUNITY_ADMIN",
  "FACILITY_MANAGER",
];

// IDs of approved residents who can approve bookings (push audience for
// approval-required requests).
export async function managerIds(): Promise<string[]> {
  const mgrs = await prisma.resident.findMany({
    where: { isApproved: true, roles: { some: { name: { in: MANAGER_ROLES } } } },
    select: { id: true },
  });
  return mgrs.map((m) => m.id);
}

export const MAX_NOTE = 200;
export const MAX_NAME = 80;
export const MAX_CAPACITY = 500;
export const MAX_WINDOW_DAYS = 120;

// Who may create/edit amenities + approve bookings: admins or the facility manager.
export function canManageAmenities(
  roles: string[] | null | undefined
): boolean {
  return isAdmin(roles) || hasExactRole(roles, "FACILITY_MANAGER");
}

// "YYYY-MM-DD" → midnight at the start of that IST day (matches habits.ts).
export function ymdToIstMidnight(ymd: string): Date {
  return new Date(`${ymd}T00:00:00+05:30`);
}

// Resolve a slot's minute offsets on a given IST date to concrete instants.
export function slotInstants(
  ymd: string,
  startMinute: number,
  endMinute: number
): { start: Date; end: Date } {
  const base = ymdToIstMidnight(ymd).getTime();
  return {
    start: new Date(base + startMinute * 60_000),
    end: new Date(base + endMinute * 60_000),
  };
}

// IST weekday (0=Sun … 6=Sat) for a YYYY-MM-DD. We anchor at IST noon (=06:30
// UTC the same calendar day) so getUTCDay() is unaffected by the host timezone
// and never rolls to the previous/next day.
export function istWeekday(ymd: string): number {
  return new Date(`${ymd}T12:00:00+05:30`).getUTCDay();
}

// Does a recurring slot apply on this date? dayOfWeek null = every day.
export function slotAppliesOn(
  slot: { dayOfWeek: number | null },
  ymd: string
): boolean {
  if (slot.dayOfWeek == null) return true;
  return istWeekday(ymd) === slot.dayOfWeek;
}

// Validate a YYYY-MM-DD string.
export function isValidYmd(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// Statuses that occupy capacity (a slot spot is taken).
export const ACTIVE_BOOKING_STATUSES = ["PENDING", "CONFIRMED"] as const;

// Is `start` within the allowed booking horizon (now … now + windowDays)?
export function addDaysInWindow(now: Date, start: Date, windowDays: number): boolean {
  const horizon = now.getTime() + windowDays * 86_400_000;
  return start.getTime() <= horizon;
}

// Format minutes-from-midnight as "6:00 AM".
export function formatMinute(min: number): string {
  const h24 = Math.floor(min / 60) % 24;
  const m = min % 60;
  const ampm = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function formatSlotRange(startMinute: number, endMinute: number): string {
  return `${formatMinute(startMinute)} – ${formatMinute(endMinute)}`;
}

// Validate a slot's minute window.
export function validateSlotMinutes(
  startRaw: unknown,
  endRaw: unknown
): { ok: true; start: number; end: number } | { ok: false; error: string } {
  const start = Number(startRaw);
  const end = Number(endRaw);
  if (!Number.isInteger(start) || !Number.isInteger(end)) {
    return { ok: false, error: "Slot times must be whole minutes" };
  }
  if (start < 0 || start >= 1440 || end <= 0 || end > 1440) {
    return { ok: false, error: "Slot times must be within a day" };
  }
  if (end <= start) {
    return { ok: false, error: "Slot end must be after its start" };
  }
  return { ok: true, start, end };
}
