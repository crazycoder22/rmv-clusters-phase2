// Shared @-mention helpers, used by both initiative comments and community
// feed comments. The client sends mentioned resident IDs; the server resolves
// canonical names from the DB (never trusting client-supplied names).

export const MAX_MENTIONS = 10;

/** A resident tagged (@mentioned) in a comment. Name is resolved server-side. */
export interface CommentMention {
  id: string;
  name: string;
}

/**
 * Normalize a client-supplied list of mentioned resident IDs: keep non-empty
 * strings, dedupe, cap at MAX_MENTIONS. Existence + names are resolved against
 * the DB in the route.
 */
export function sanitizeMentionIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const id = item.trim();
    if (id) seen.add(id);
    if (seen.size >= MAX_MENTIONS) break;
  }
  return [...seen];
}
