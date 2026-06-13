import { prisma } from "@/lib/prisma";

// Page views are tracked across all pages (an auto-tracker derives feature/pageKey
// from the route), so instead of an explicit allowlist we sanitise the keys: a
// trackable key is lowercase [a-z0-9_-], 1-40 chars. Anything else → null (ignored).
// This keeps the table clean (no arbitrary/garbage keys) without per-page upkeep.
export function cleanKey(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const v = s.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
  return v.length ? v : null;
}

// Collapse repeat opens (refresh / HMR / StrictMode double-mount / back-forward)
// of the same page by the same resident into one "open" per viewing session.
// Per-resident key → never affects unique-resident counts, only repeat rows.
const DEDUP_MS = 30 * 60 * 1000;

// Fire-and-forget: record a page view, deduped. Never blocks the caller or throws.
export function recordPageView(args: {
  residentId: string;
  feature: string;
  pageKey: string;
  entityId: string | null;
  platform: string;
}): void {
  void (async () => {
    const recent = await prisma.pageView.findFirst({
      where: {
        residentId: args.residentId,
        feature: args.feature,
        pageKey: args.pageKey,
        entityId: args.entityId,
        createdAt: { gt: new Date(Date.now() - DEDUP_MS) },
      },
      select: { id: true },
    });
    if (recent) return;
    await prisma.pageView.create({ data: { ...args } });
  })().catch(() => {});
}

// Sanity cap so a stuck timer / clock skew can't write a garbage duration.
const MAX_DWELL_MS = 6 * 60 * 60 * 1000; // 6 hours

// Fire-and-forget: attach a dwell time to this resident's most recent view of
// the page. The duration the client sends is cumulative-for-the-visit, so we
// keep the largest seen. Falls back to creating a row if the view didn't land.
export function recordDwell(args: {
  residentId: string;
  feature: string;
  pageKey: string;
  entityId: string | null;
  durationMs: number;
  platform: string;
}): void {
  const dur = Math.min(Math.round(args.durationMs), MAX_DWELL_MS);
  void (async () => {
    const recent = await prisma.pageView.findFirst({
      where: {
        residentId: args.residentId,
        feature: args.feature,
        pageKey: args.pageKey,
        entityId: args.entityId,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, durationMs: true },
    });
    if (recent) {
      const next = Math.max(recent.durationMs ?? 0, dur);
      if (next !== recent.durationMs) {
        await prisma.pageView.update({ where: { id: recent.id }, data: { durationMs: next } });
      }
    } else {
      await prisma.pageView.create({
        data: {
          residentId: args.residentId,
          feature: args.feature,
          pageKey: args.pageKey,
          entityId: args.entityId,
          platform: args.platform,
          durationMs: dur,
        },
      });
    }
  })().catch(() => {});
}
