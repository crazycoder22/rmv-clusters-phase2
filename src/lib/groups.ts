// Shared helpers for Sports Groups + recurring polls.

export const MAX_NAME = 80;
export const MAX_DESCRIPTION = 500;
export const MAX_POLL_TITLE = 150;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 6;
export const MAX_OPTION_LEN = 40;
export const MAX_CLOSE_NOTE = 500;

export const DEFAULT_OPTIONS = ["In", "Out", "Maybe"];

export type GroupPollStatusValue = "OPEN" | "CLOSED";
export type GroupPollOutcomeValue = "GAME_ON" | "CANCELLED";

/** A poll accepts votes only while OPEN and (if a deadline is set) before it. */
export function isPollOpen(
  status: GroupPollStatusValue,
  closesAt: Date | null,
  now: Date = new Date()
): boolean {
  if (status !== "OPEN") return false;
  if (closesAt && closesAt.getTime() <= now.getTime()) return false;
  return true;
}

export function validateGroup(
  raw: unknown
): { ok: true; data: { name: string; description: string | null } } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Invalid request" };
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === "string" ? r.name.trim() : "";
  if (!name) return { ok: false, error: "Give the group a name" };
  if (name.length > MAX_NAME) return { ok: false, error: `Name must be under ${MAX_NAME} characters` };
  const description =
    typeof r.description === "string" && r.description.trim() ? r.description.trim().slice(0, MAX_DESCRIPTION) : null;
  return { ok: true, data: { name, description } };
}

export interface ValidatedPoll {
  title: string;
  playAt: Date | null;
  closesAt: Date | null;
  options: string[];
}

export function validatePoll(
  raw: unknown
): { ok: true; data: ValidatedPoll } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Invalid request" };
  const r = raw as Record<string, unknown>;

  const title = typeof r.title === "string" ? r.title.trim() : "";
  if (!title) return { ok: false, error: "Give the poll a title" };
  if (title.length > MAX_POLL_TITLE) return { ok: false, error: `Title must be under ${MAX_POLL_TITLE} characters` };

  const playAt = parseOptionalDate(r.playAt);
  if (playAt === "invalid") return { ok: false, error: "Invalid play date/time" };
  const closesAt = parseOptionalDate(r.closesAt);
  if (closesAt === "invalid") return { ok: false, error: "Invalid voting deadline" };

  let options: string[];
  if (Array.isArray(r.options) && r.options.length > 0) {
    options = r.options.map((o) => (typeof o === "string" ? o.trim() : "")).filter(Boolean);
  } else {
    options = [...DEFAULT_OPTIONS];
  }
  if (options.length < MIN_OPTIONS) return { ok: false, error: `Add at least ${MIN_OPTIONS} options` };
  if (options.length > MAX_OPTIONS) return { ok: false, error: `At most ${MAX_OPTIONS} options` };
  if (options.some((o) => o.length > MAX_OPTION_LEN)) return { ok: false, error: `Each option must be under ${MAX_OPTION_LEN} characters` };
  if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) {
    return { ok: false, error: "Options must be unique" };
  }

  return { ok: true, data: { title, playAt: playAt as Date | null, closesAt: closesAt as Date | null, options } };
}

function parseOptionalDate(v: unknown): Date | null | "invalid" {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string") return "invalid";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "invalid" : d;
}
