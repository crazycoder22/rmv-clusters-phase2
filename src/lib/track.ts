import { prisma } from "@/lib/prisma";

// Whitelist of trackable (feature → pageKeys). Clients can only record views
// for these; anything else is silently ignored by the /api/track endpoint.
// Adding a new page = add its key here + one track() call on the client. No migration.
export const TRACKABLE: Record<string, readonly string[]> = {
  initiatives: ["list", "detail"],
};

export function isTrackable(feature: unknown, pageKey: unknown): boolean {
  return (
    typeof feature === "string" &&
    typeof pageKey === "string" &&
    TRACKABLE[feature]?.includes(pageKey) === true
  );
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
