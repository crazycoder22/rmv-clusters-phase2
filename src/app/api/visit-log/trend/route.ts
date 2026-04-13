import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/roles";

export const dynamic = "force-dynamic";

// GET /api/visit-log/trend — daily resident-approval % for the last N days
// Query params:
//   days  number of days (default 30, max 90)
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdmin(session.user.roles)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const days = Math.min(Number(searchParams.get("days")) || 30, 90);

    // Get all visit dates with counts
    const rows = await prisma.visitLog.groupBy({
      by: ["visitDate", "approvedByResident"],
      _count: { _all: true },
      orderBy: { visitDate: "asc" },
    });

    // Build a map: date -> { total, approved }
    const dateMap = new Map<string, { total: number; approved: number }>();
    for (const row of rows) {
      const entry = dateMap.get(row.visitDate) || { total: 0, approved: 0 };
      entry.total += row._count._all;
      if (row.approvedByResident) entry.approved += row._count._all;
      dateMap.set(row.visitDate, entry);
    }

    // Sort by date and take last N days
    const sorted = [...dateMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-days);

    const trend = sorted.map(([date, { total, approved }]) => ({
      date,
      total,
      approved,
      pct: total > 0 ? Math.round((approved / total) * 100) : 0,
    }));

    return NextResponse.json({ trend });
  } catch (err) {
    console.error("GET /api/visit-log/trend failed:", err);
    return NextResponse.json({ error: "Failed to fetch trend" }, { status: 500 });
  }
}
