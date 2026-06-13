// Shared helpers for the Initiatives feedback feature.
// Commenting is time-bound: each initiative has a `commentsCloseAt` deadline,
// after which no new feedback or replies can be added (but likes stay open).

export const MAX_TITLE = 150;
export const MAX_BODY = 5000;
export const MAX_COMMENT = 2000;

export type InitiativeStatusValue = "OPEN" | "CLOSED" | "ARCHIVED";

/**
 * The single source of truth for "can someone still comment?".
 * Effective-open = status is OPEN *and* the deadline hasn't passed.
 * `now` is injected so callers control the clock (server clock, never client).
 */
export function isCommentingOpen(
  status: InitiativeStatusValue,
  commentsCloseAt: Date,
  now: Date = new Date()
): boolean {
  return status === "OPEN" && commentsCloseAt.getTime() > now.getTime();
}

export interface ValidatedInitiative {
  title: string;
  body: string;
  imageUrl: string | null;
  youtubeUrl: string | null;
  commentsCloseAt: Date;
}

/** Extract the 11-char video id from any common YouTube URL (or null). */
export function youtubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

export function validateInitiative(
  raw: unknown,
  now: Date = new Date()
): { ok: true; data: ValidatedInitiative } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Invalid request" };
  const r = raw as Record<string, unknown>;

  const title = typeof r.title === "string" ? r.title.trim() : "";
  if (!title) return { ok: false, error: "Give the initiative a title" };
  if (title.length > MAX_TITLE) return { ok: false, error: `Title must be under ${MAX_TITLE} characters` };

  const body = typeof r.body === "string" ? r.body.trim() : "";
  if (!body) return { ok: false, error: "Describe the initiative" };
  if (body.length > MAX_BODY) return { ok: false, error: `Description must be under ${MAX_BODY} characters` };

  if (typeof r.commentsCloseAt !== "string") return { ok: false, error: "Set a feedback deadline" };
  const commentsCloseAt = new Date(r.commentsCloseAt);
  if (isNaN(commentsCloseAt.getTime())) return { ok: false, error: "Invalid deadline" };
  if (commentsCloseAt.getTime() <= now.getTime()) return { ok: false, error: "The deadline must be in the future" };

  const imageUrl = typeof r.imageUrl === "string" && r.imageUrl.trim() ? r.imageUrl.trim() : null;

  let youtubeUrl: string | null = null;
  if (typeof r.youtubeUrl === "string" && r.youtubeUrl.trim()) {
    const raw = r.youtubeUrl.trim();
    if (!youtubeId(raw)) {
      return { ok: false, error: "That doesn't look like a YouTube link" };
    }
    youtubeUrl = raw;
  }

  return { ok: true, data: { title, body, imageUrl, youtubeUrl, commentsCloseAt } };
}

/** Validate a comment/reply body. */
export function validateComment(raw: unknown): { ok: true; content: string } | { ok: false; error: string } {
  const content = typeof raw === "string" ? raw.trim() : "";
  if (!content) return { ok: false, error: "Write something first" };
  if (content.length > MAX_COMMENT) return { ok: false, error: `Keep it under ${MAX_COMMENT} characters` };
  return { ok: true, content };
}
