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
      topSources,
      topFlats,
      topGuards,
    ] = await Promise.all([
      prisma.visitLog.count({ where: { visitDate: today } }),
      prisma.visitLog.count({ where: { visitDate: { gte: d7 } } }),
      prisma.visitLog.count({ where: { visitDate: { gte: d30 } } }),
      prisma.visitLog.groupBy({
        by: ["fromSource"],
        _count: { _all: true },
        where: { visitDate: { gte: d30 }, fromSource: { not: null } },
        orderBy: { _count: { fromSource: "desc" } },
        take: 3,
      }),
      prisma.visitLog.groupBy({
        by: ["block", "flatNumber"],
        _count: { _all: true },
        where: { visitDate: { gte: d30 }, block: { not: null }, flatNumber: { not: null } },
        orderBy: { _count: { block: "desc" } },
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

    return NextResponse.json({
      windowDays: 30,
      todayCount,
      last7Count,
      last30Count,
      topSources: topSources.map((r) => ({ source: r.fromSource, count: r._count._all })),
      topFlats: topFlats.map((r) => ({ block: r.block, flatNumber: r.flatNumber, count: r._count._all })),
      topGuards: topGuards.map((r) => ({ guard: r.allowedByGuard, count: r._count._all })),
    });
  } catch (err) {
    console.error("GET /api/visit-log/stats failed:", err);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
