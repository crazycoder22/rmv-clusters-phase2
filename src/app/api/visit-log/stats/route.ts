import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/roles";
import { istTodayYmd } from "@/lib/dates-ist";
import { getAuthedResident } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// GET /api/visit-log/stats — admin-only summary
// Query params:
//   dateFrom  YYYY-MM-DD (default: today IST)
//   dateTo    YYYY-MM-DD (default: dateFrom)
//
// Accepts NextAuth cookie (web) or `Authorization: Bearer <jwt>` (mobile).
export async function GET(request: Request) {
  try {
    const resident = await getAuthedResident(request);
    if (!resident) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdmin(resident.roles)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("dateFrom") || istTodayYmd();
    const dateTo = searchParams.get("dateTo") || dateFrom;

    const dateWhere =
      dateFrom === dateTo
        ? { visitDate: dateFrom }
        : { visitDate: { gte: dateFrom, lte: dateTo } };

    const [
      rangeCount,
      rangeResidentApproved,
      blockTotals,
      blockResidentApproved,
      topSources,
      topGuards,
    ] = await Promise.all([
      prisma.visitLog.count({ where: dateWhere }),
      prisma.visitLog.count({ where: { ...dateWhere, approvedByResident: true } }),
      // Per-block totals. block=null rows (COMMON AREA, masked) are excluded.
      prisma.visitLog.groupBy({
        by: ["block"],
        _count: { _all: true },
        where: { ...dateWhere, block: { not: null } },
      }),
      // Per-block resident-approved counts
      prisma.visitLog.groupBy({
        by: ["block"],
        _count: { _all: true },
        where: { ...dateWhere, block: { not: null }, approvedByResident: true },
      }),
      prisma.visitLog.groupBy({
        by: ["fromSource"],
        _count: { _all: true },
        where: { ...dateWhere, fromSource: { not: null } },
        orderBy: { _count: { fromSource: "desc" } },
        take: 3,
      }),
      prisma.visitLog.groupBy({
        by: ["allowedByGuard"],
        _count: { _all: true },
        where: { ...dateWhere, allowedByGuard: { not: null } },
        orderBy: { _count: { allowedByGuard: "desc" } },
        take: 3,
      }),
    ]);

    // Merge per-block totals + resident-approved counts into one array (block 1..4)
    const residentByBlock = new Map<number, number>();
    for (const row of blockResidentApproved) {
      if (row.block != null) residentByBlock.set(row.block, row._count._all);
    }
    const totalsByBlock = new Map<number, number>();
    for (const row of blockTotals) {
      if (row.block != null) totalsByBlock.set(row.block, row._count._all);
    }
    const byBlock = [1, 2, 3, 4].map((block) => ({
      block,
      total: totalsByBlock.get(block) ?? 0,
      residentApproved: residentByBlock.get(block) ?? 0,
    }));

    return NextResponse.json({
      dateFrom,
      dateTo,
      rangeCount,
      rangeResidentApproved,
      byBlock,
      topSources: topSources.map((r) => ({ source: r.fromSource, count: r._count._all })),
      topGuards: topGuards.map((r) => ({ guard: r.allowedByGuard, count: r._count._all })),
    });
  } catch (err) {
    console.error("GET /api/visit-log/stats failed:", err);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
