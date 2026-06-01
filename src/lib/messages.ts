// Shared helpers for 1:1 direct messaging.
//
// A Conversation stores its two participants in canonical order (aId < bId)
// so there is exactly one row per pair regardless of who starts it. Per-user
// state (last-read + hidden) is denormalised onto A/B columns.

export const MAX_BODY = 4000;

/** Canonical participant ordering: smaller id is always "a". */
export function orderPair(x: string, y: string): [string, string] {
  return x < y ? [x, y] : [y, x];
}

export interface ConvLike {
  aId: string;
  bId: string;
  aLastReadAt: Date | null;
  bLastReadAt: Date | null;
  aHiddenAt: Date | null;
  bHiddenAt: Date | null;
}

export function meIsA(conv: { aId: string }, myId: string): boolean {
  return conv.aId === myId;
}

export function otherId(conv: { aId: string; bId: string }, myId: string): string {
  return conv.aId === myId ? conv.bId : conv.aId;
}

type ReadFields = { aId: string; aLastReadAt: Date | null; bLastReadAt: Date | null };
type HiddenFields = { aId: string; aHiddenAt: Date | null; bHiddenAt: Date | null };

export function myLastReadAt(conv: ReadFields, myId: string): Date | null {
  return meIsA(conv, myId) ? conv.aLastReadAt : conv.bLastReadAt;
}

export function otherLastReadAt(conv: ReadFields, myId: string): Date | null {
  return meIsA(conv, myId) ? conv.bLastReadAt : conv.aLastReadAt;
}

export function myHiddenAt(conv: HiddenFields, myId: string): Date | null {
  return meIsA(conv, myId) ? conv.aHiddenAt : conv.bHiddenAt;
}

/** The Prisma `data` patch to set MY lastReadAt (A or B column). */
export function setMyLastReadData(conv: { aId: string }, myId: string, when: Date) {
  return meIsA(conv, myId) ? { aLastReadAt: when } : { bLastReadAt: when };
}

/** The Prisma `data` patch to set MY hiddenAt. */
export function setMyHiddenData(conv: { aId: string }, myId: string, when: Date | null) {
  return meIsA(conv, myId) ? { aHiddenAt: when } : { bHiddenAt: when };
}

/** The Prisma `data` patch to clear the OTHER participant's hiddenAt (resurface on new message). */
export function clearOtherHiddenData(conv: { aId: string }, myId: string) {
  return meIsA(conv, myId) ? { bHiddenAt: null } : { aHiddenAt: null };
}

export function validateBody(raw: unknown): { ok: true; body: string } | { ok: false; error: string } {
  const body = typeof raw === "string" ? raw.trim() : "";
  if (!body) return { ok: false, error: "Type a message" };
  if (body.length > MAX_BODY) return { ok: false, error: `Message must be under ${MAX_BODY} characters` };
  return { ok: true, body };
}
