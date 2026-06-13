import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedResident } from "@/lib/api-auth";
import { isAdmin } from "@/lib/roles";

export const dynamic = "force-dynamic";

type PlatformSplit = { web: number; ios: number; android: number; app: number };
const emptySplit = (): PlatformSplit => ({ web: 0, ios: 0, android: 0, app: 0 });
function addPlatform(split: PlatformSplit, platform: string, n: number) {
  if (platform === "web" || platform === "ios" || platform === "android") split[platform] += n;
  else split.app += n;
}

// GET /api/admin/usage/pages — aggregate page-view analytics (counts only, no
// resident identities). Admin only. Powers the "Page views" section of the
// /admin/usage dashboard.
export async function GET(request: Request) {
  const me = await getAuthedResident(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me.roles)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const since = new Date(Date.now() - 30 * 86_400_000);

  const [byPage, byPagePlatform, byEntity, byEntityPlatform, pageUniqueRows, entityUniqueRows, trendRows] =
    await Promise.all([
      prisma.pageView.groupBy({ by: ["feature", "pageKey"], _count: { _all: true }, _avg: { durationMs: true } }),
      prisma.pageView.groupBy({ by: ["feature", "pageKey", "platform"], _count: { _all: true } }),
      prisma.pageView.groupBy({
        by: ["entityId"],
        where: { feature: "initiatives", pageKey: "detail", entityId: { not: null } },
        _count: { _all: true },
        _avg: { durationMs: true },
      }),
      prisma.pageView.groupBy({
        by: ["entityId", "platform"],
        where: { feature: "initiatives", pageKey: "detail", entityId: { not: null } },
        _count: { _all: true },
      }),
      // distinct (feature,pageKey,resident) → count uniques per page (groupBy can't COUNT DISTINCT)
      prisma.pageView.findMany({
        distinct: ["feature", "pageKey", "residentId"],
        select: { feature: true, pageKey: true },
      }),
      prisma.pageView.findMany({
        where: { feature: "initiatives", pageKey: "detail", entityId: { not: null } },
        distinct: ["entityId", "residentId"],
        select: { entityId: true },
      }),
      prisma.pageView.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    ]);

  // ── Per-page (feature + pageKey) ──
  const pageUnique = new Map<string, number>();
  for (const r of pageUniqueRows) {
    const k = `${r.feature}|${r.pageKey}`;
    pageUnique.set(k, (pageUnique.get(k) ?? 0) + 1);
  }
  const pagePlatform = new Map<string, PlatformSplit>();
  for (const r of byPagePlatform) {
    const k = `${r.feature}|${r.pageKey}`;
    const s = pagePlatform.get(k) ?? emptySplit();
    addPlatform(s, r.platform, r._count._all);
    pagePlatform.set(k, s);
  }
  const features = byPage
    .map((r) => {
      const k = `${r.feature}|${r.pageKey}`;
      return {
        feature: r.feature,
        pageKey: r.pageKey,
        totalOpens: r._count._all,
        uniqueResidents: pageUnique.get(k) ?? 0,
        avgDwellMs: r._avg.durationMs != null ? Math.round(r._avg.durationMs) : null,
        platform: pagePlatform.get(k) ?? emptySplit(),
      };
    })
    .sort((a, b) => b.totalOpens - a.totalOpens);

  // ── Per-initiative (detail page entityId) ──
  const entityIds = byEntity.map((r) => r.entityId!).filter(Boolean);
  const initiativeRows = entityIds.length
    ? await prisma.initiative.findMany({ where: { id: { in: entityIds } }, select: { id: true, title: true } })
    : [];
  const titleById = new Map(initiativeRows.map((i) => [i.id, i.title]));

  const entityUnique = new Map<string, number>();
  for (const r of entityUniqueRows) {
    if (!r.entityId) continue;
    entityUnique.set(r.entityId, (entityUnique.get(r.entityId) ?? 0) + 1);
  }
  const entityPlatform = new Map<string, PlatformSplit>();
  for (const r of byEntityPlatform) {
    if (!r.entityId) continue;
    const s = entityPlatform.get(r.entityId) ?? emptySplit();
    addPlatform(s, r.platform, r._count._all);
    entityPlatform.set(r.entityId, s);
  }
  const initiatives = byEntity
    .map((r) => ({
      id: r.entityId!,
      title: titleById.get(r.entityId!) ?? "(deleted)",
      totalOpens: r._count._all,
      uniqueResidents: entityUnique.get(r.entityId!) ?? 0,
      avgDwellMs: r._avg.durationMs != null ? Math.round(r._avg.durationMs) : null,
      platform: entityPlatform.get(r.entityId!) ?? emptySplit(),
    }))
    .sort((a, b) => b.totalOpens - a.totalOpens);

  // ── Daily trend (last 30 days, IST-bucketed) ──
  const dayMap = new Map<string, number>();
  for (const r of trendRows) {
    const ymd = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(r.createdAt);
    dayMap.set(ymd, (dayMap.get(ymd) ?? 0) + 1);
  }
  const trend = [...dayMap.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({ features, initiatives, trend });
}
