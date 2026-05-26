import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/roles";
import { istTodayYmd } from "@/lib/dates-ist";
import { getAuthedResident } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// GET /api/visit-log/by-flat — admin-only per-flat approval breakdown.
//
// Returns one row per (block, flatNumber) with total visits, approved count,
// and a pct rounded to integer. Sorted by lowest pct first (so the worst
// offenders surface at the top of an admin's screen). Rows with block=null
// (common areas, masked) are excluded.
//
// Query params:
//   dateFrom  YYYY-MM-DD  (default: 7 days ago IST)
//   dateTo    YYYY-MM-DD  (default: today IST)
//   block     1..4        (optional — filter to one block)
//   minTotal  number      (optional, default 1 — drop flats with too few
//                          visits in the window, eg. set to 5 to ignore
//                          inactive flats during slow weeks)
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
    const today = istTodayYmd();

    // Default window: last 7 IST days, inclusive
    let dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo") || today;
    if (!dateFrom) {
      const d = new Date(`${today}T00:00:00+05:30`);
      d.setDate(d.getDate() - 6);
      dateFrom = d.toISOString().slice(0, 10);
    }

    const blockParam = searchParams.get("block");
    const block =
      blockParam && ["1", "2", "3", "4"].includes(blockParam)
        ? Number(blockParam)
        : null;

    const minTotalRaw = parseInt(searchParams.get("minTotal") || "1", 10);
    const minTotal = Number.isFinite(minTotalRaw) && minTotalRaw > 0 ? minTotalRaw : 1;

    const dateWhere =
      dateFrom === dateTo
        ? { visitDate: dateFrom }
        : { visitDate: { gte: dateFrom, lte: dateTo } };

    const baseWhere = {
      ...dateWhere,
      block: block !== null ? { equals: block } : { not: null },
      flatNumber: { not: null },
    };

    const [totals, approved] = await Promise.all([
      prisma.visitLog.groupBy({
        by: ["block", "flatNumber"],
        _count: { _all: true },
        where: baseWhere,
      }),
      prisma.visitLog.groupBy({
        by: ["block", "flatNumber"],
        _count: { _all: true },
        where: { ...baseWhere, approvedByResident: true },
      }),
    ]);

    // Index approved by "block|flat" so we can join in O(n).
    const approvedKey = (b: number | null, f: string | null) =>
      `${b ?? "_"}|${f ?? "_"}`;
    const approvedMap = new Map<string, number>();
    for (const row of approved) {
      approvedMap.set(approvedKey(row.block, row.flatNumber), row._count._all);
    }

    const flats = totals
      .filter((row) => row.block != null && row.flatNumber != null)
      .map((row) => {
        const total = row._count._all;
        const a = approvedMap.get(approvedKey(row.block, row.flatNumber)) ?? 0;
        return {
          block: row.block as number,
          flatNumber: row.flatNumber as string,
          total,
          approved: a,
          pct: total > 0 ? Math.round((a / total) * 100) : 0,
        };
      })
      .filter((row) => row.total >= minTotal)
      // Lowest pct first; tie-break on most total visits (more painful).
      .sort((a, b) => a.pct - b.pct || b.total - a.total);

    return NextResponse.json({
      dateFrom,
      dateTo,
      block,
      minTotal,
      flats,
    });
  } catch (err) {
    console.error("GET /api/visit-log/by-flat failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch per-flat stats" },
      { status: 500 }
    );
  }
}
