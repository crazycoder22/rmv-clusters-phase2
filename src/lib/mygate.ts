// Parsers for the MyGate Help Desk "Download Report" export. The report uses
// IST wall-clock strings and human-readable durations; we normalise them for
// the MygateComplaint mirror.

const NULLISH = new Set(["", "none", "na", "null", "-"]);
function clean(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = String(s).trim();
  return NULLISH.has(t.toLowerCase()) ? null : t;
}

// "05-06-26, 09:54 AM" (DD-MM-YY, hh:mm AM/PM, IST) → Date. null if unparseable.
export function parseMygateDate(s: string | null | undefined): Date | null {
  const v = clean(s);
  if (!v) return null;
  const m = v.match(/^(\d{2})-(\d{2})-(\d{2}),\s*(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  const [, dd, mm, yy, hhRaw, min, ap] = m;
  let H = parseInt(hhRaw, 10) % 12;
  if (/pm/i.test(ap)) H += 12;
  const iso = `20${yy}-${mm}-${dd}T${String(H).padStart(2, "0")}:${min}:00+05:30`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

// "3-105" → {block:3, flatNumber:"105"}; "2-604/605" → {2,"604/605"};
// "COMMON AREA-Facilities" → {block:null, flatNumber:null} (kept in flatRaw).
export function parseFlat(s: string | null | undefined): {
  block: number | null;
  flatNumber: string | null;
  flatRaw: string | null;
} {
  const raw = clean(s);
  if (!raw) return { block: null, flatNumber: null, flatRaw: null };
  const m = raw.match(/^(\d+)-(.+)$/);
  if (m) return { block: parseInt(m[1], 10), flatNumber: m[2].trim(), flatRaw: raw };
  return { block: null, flatNumber: null, flatRaw: raw };
}

// "5 day(s): 18 hour(s): 56 minute(s)" → total minutes (6536). null if missing.
export function parseDurationMinutes(s: string | null | undefined): number | null {
  const v = clean(s);
  if (!v) return null;
  const m = v.match(/(\d+)\s*day.*?(\d+)\s*hour.*?(\d+)\s*minute/i);
  if (!m) return null;
  return parseInt(m[1], 10) * 1440 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10);
}

export function parseIntSafe(s: string | null | undefined): number | null {
  const v = clean(s);
  if (v == null) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

// MyGate statuses that mean "done". Everything else counts as open.
export const CLOSED_STATUSES = new Set(["resolved", "closed"]);
export function isOpenStatus(status: string | null | undefined): boolean {
  return !CLOSED_STATUSES.has((status ?? "").trim().toLowerCase());
}

export function strOrNull(s: string | null | undefined): string | null {
  return clean(s);
}
