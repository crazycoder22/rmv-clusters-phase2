// Shared helpers for the Referendum feature — a binding, secret-ballot,
// one-flat-one-vote decision instrument.
//
// Integrity rules live here so every call site enforces them identically:
//  - eligibility (owners-only vs all residents)
//  - voting-open window (status + deadline, server clock only)
//  - results hidden until the referendum is closed

export const MAX_TITLE = 150;
export const MAX_BODY = 5000;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 10;
export const MAX_OPTION_LEN = 120;

export type ReferendumStatusValue = "OPEN" | "CLOSED";
export type ReferendumEligibilityValue = "OWNERS_ONLY" | "ALL_RESIDENTS";

// residentType values that count as "owner" for an owners-only referendum.
// Includes the owner's household; tenants (TENANT / TENANT_FAMILY / MULTI_TENANT)
// are excluded.
export const OWNER_TYPES = ["OWNER", "OWNER_FAMILY"] as const;

export function isOwnerType(residentType: string): boolean {
  return (OWNER_TYPES as readonly string[]).includes(residentType);
}

export function isEligible(residentType: string, eligibility: ReferendumEligibilityValue): boolean {
  if (eligibility === "ALL_RESIDENTS") return true;
  return isOwnerType(residentType);
}

/** Voting is open only while status is OPEN and the deadline hasn't passed. */
export function isVotingOpen(
  status: ReferendumStatusValue,
  closesAt: Date,
  now: Date = new Date()
): boolean {
  return status === "OPEN" && closesAt.getTime() > now.getTime();
}

/** Results become visible exactly when voting is no longer open (closed early OR expired). */
export function isResultVisible(
  status: ReferendumStatusValue,
  closesAt: Date,
  now: Date = new Date()
): boolean {
  return !isVotingOpen(status, closesAt, now);
}

export interface ValidatedReferendum {
  title: string;
  body: string;
  imageUrl: string | null;
  eligibility: ReferendumEligibilityValue;
  closesAt: Date;
  options: string[];
}

export function validateReferendum(
  raw: unknown,
  now: Date = new Date()
): { ok: true; data: ValidatedReferendum } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Invalid request" };
  const r = raw as Record<string, unknown>;

  const title = typeof r.title === "string" ? r.title.trim() : "";
  if (!title) return { ok: false, error: "Give the referendum a title" };
  if (title.length > MAX_TITLE) return { ok: false, error: `Title must be under ${MAX_TITLE} characters` };

  const body = typeof r.body === "string" ? r.body.trim() : "";
  if (!body) return { ok: false, error: "Describe what residents are voting on" };
  if (body.length > MAX_BODY) return { ok: false, error: `Description must be under ${MAX_BODY} characters` };

  const eligibility = r.eligibility === "OWNERS_ONLY" ? "OWNERS_ONLY" : "ALL_RESIDENTS";

  if (typeof r.closesAt !== "string") return { ok: false, error: "Set a voting deadline" };
  const closesAt = new Date(r.closesAt);
  if (isNaN(closesAt.getTime())) return { ok: false, error: "Invalid deadline" };
  if (closesAt.getTime() <= now.getTime()) return { ok: false, error: "The deadline must be in the future" };

  if (!Array.isArray(r.options)) return { ok: false, error: "Add voting options" };
  const options = r.options
    .map((o) => (typeof o === "string" ? o.trim() : ""))
    .filter((o) => o.length > 0);
  if (options.length < MIN_OPTIONS) return { ok: false, error: `Add at least ${MIN_OPTIONS} options` };
  if (options.length > MAX_OPTIONS) return { ok: false, error: `At most ${MAX_OPTIONS} options` };
  if (options.some((o) => o.length > MAX_OPTION_LEN)) return { ok: false, error: `Each option must be under ${MAX_OPTION_LEN} characters` };
  const lower = options.map((o) => o.toLowerCase());
  if (new Set(lower).size !== lower.length) return { ok: false, error: "Options must be unique" };

  const imageUrl = typeof r.imageUrl === "string" && r.imageUrl.trim() ? r.imageUrl.trim() : null;

  return { ok: true, data: { title, body, imageUrl, eligibility, closesAt, options } };
}
