import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { canViewMygate } from "@/lib/mygate-auth";

export const dynamic = "force-dynamic";

// GET /api/admin/mygate-complaints/analytics → aggregate dashboards.
export async function GET(request: Request) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canViewMygate(me.roles)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [
    total,
    openCount,
    byStatus,
    byCategory,
    byBlock,
    byAssignee,
    avgRes,
    byCatRes,
    createdDates,
  ] = await Promise.all([
    prisma.mygateComplaint.count(),
    prisma.mygateComplaint.count({ where: { isOpen: true } }),
    prisma.mygateComplaint.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.mygateComplaint.groupBy({ by: ["category"], _count: { _all: true } }),
    prisma.mygateComplaint.groupBy({ by: ["block"], _count: { _all: true } }),
    prisma.mygateComplaint.groupBy({ by: ["assignee"], _count: { _all: true } }),
    prisma.mygateComplaint.aggregate({ _avg: { resolutionMinutes: true }, where: { resolutionMinutes: { not: null } } }),
    prisma.mygateComplaint.groupBy({ by: ["category"], _avg: { resolutionMinutes: true }, where: { resolutionMinutes: { not: null } } }),
    prisma.mygateComplaint.findMany({ where: { mygateCreatedAt: { not: null } }, select: { mygateCreatedAt: true } }),
  ]);

  const pair = (
    rows: { _count: { _all: number } }[],
    key: string
  ) =>
    rows
      .map((r) => ({ label: ((r as Record<string, unknown>)[key] ?? "—") as string | number, count: r._count._all }))
      .sort((a, b) => b.count - a.count);

  // Created-per-month buckets (YYYY-MM).
  const monthMap = new Map<string, number>();
  for (const r of createdDates) {
    if (!r.mygateCreatedAt) continue;
    const ym = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" }).format(r.mygateCreatedAt);
    monthMap.set(ym, (monthMap.get(ym) ?? 0) + 1);
  }
  const byMonth = [...monthMap.entries()].map(([month, count]) => ({ month, count })).sort((a, b) => a.month.localeCompare(b.month));

  return NextResponse.json({
    total,
    openCount,
    closedCount: total - openCount,
    avgResolutionMinutes: avgRes._avg.resolutionMinutes ? Math.round(avgRes._avg.resolutionMinutes) : null,
    byStatus: pair(byStatus, "status"),
    byCategory: pair(byCategory, "category"),
    byBlock: pair(byBlock, "block").map((b) => ({ ...b, label: b.label === "—" ? "Common" : `Block ${b.label}` })),
    byAssignee: pair(byAssignee, "assignee").slice(0, 8),
    byCategoryResolution: byCatRes
      .map((r) => ({ label: r.category ?? "—", avgMinutes: r._avg.resolutionMinutes ? Math.round(r._avg.resolutionMinutes) : null }))
      .filter((r) => r.avgMinutes != null)
      .sort((a, b) => (b.avgMinutes ?? 0) - (a.avgMinutes ?? 0)),
    byMonth,
  });
}
