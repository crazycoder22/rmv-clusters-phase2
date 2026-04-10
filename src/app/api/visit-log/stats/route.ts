import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/roles";
import { istTodayYmd, istYmdDaysAgo } from "@/lib/dates-ist";

export const dynamic = "force-dynamic";

// GET /api/visit-log/stats — admin-only summary
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdmin(session.user.roles)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const today = istTodayYmd();
    const d7 = istYmdDaysAgo(6); // last 7 days inclusive of today
    const d30 = istYmdDaysAgo(29); // last 30 days inclusive

    const [
      todayCount,
      last7Count,
      last30Count,
      todayResidentApproved,
      last7ResidentApproved,
      last30ResidentApproved,
      blockTotals,
      blockResidentApproved,
      topSources,
      topGuards,
    ] = await Promise.all([
      prisma.visitLog.count({ where: { visitDate: today } }),
      prisma.visitLog.count({ where: { visitDate: { gte: d7 } } }),
      prisma.visitLog.count({ where: { visitDate: { gte: d30 } } }),
      prisma.visitLog.count({ where: { visitDate: today, approvedByResident: true } }),
      prisma.visitLog.count({ where: { visitDate: { gte: d7 }, approvedByResident: true } }),
      prisma.visitLog.count({ where: { visitDate: { gte: d30 }, approvedByResident: true } }),
      // Per-block totals (last 30d). block=null rows (COMMON AREA, masked) are excluded.
      prisma.visitLog.groupBy({
        by: ["block"],
        _count: { _all: true },
        where: { visitDate: { gte: d30 }, block: { not: null } },
      }),
      // Per-block resident-approved counts (last 30d)
      prisma.visitLog.groupBy({
        by: ["block"],
        _count: { _all: true },
        where: {
          visitDate: { gte: d30 },
          block: { not: null },
          approvedByResident: true,
        },
      }),
      prisma.visitLog.groupBy({
        by: ["fromSource"],
        _count: { _all: true },
        where: { visitDate: { gte: d30 }, fromSource: { not: null } },
        orderBy: { _count: { fromSource: "desc" } },
        take: 3,
      }),
      prisma.visitLog.groupBy({
        by: ["allowedByGuard"],
        _count: { _all: true },
        where: { visitDate: { gte: d30 }, allowedByGuard: { not: null } },
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
      windowDays: 30,
      todayCount,
      last7Count,
      last30Count,
      todayResidentApproved,
      last7ResidentApproved,
      last30ResidentApproved,
      byBlock,
      topSources: topSources.map((r) => ({ source: r.fromSource, count: r._count._all })),
      topGuards: topGuards.map((r) => ({ guard: r.allowedByGuard, count: r._count._all })),
    });
  } catch (err) {
    console.error("GET /api/visit-log/stats failed:", err);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
