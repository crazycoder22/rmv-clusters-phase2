import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/roles";
import { istTodayYmd } from "@/lib/dates-ist";
import { getAuthedResident } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// GET /api/visit-log
//
// Query params:
//   scope              "mine" (default) → caller's own flat. Accepts both
//                                          NextAuth cookie and the mobile
//                                          Bearer JWT.
//                      "all"             → all entries; admin only and
//                                          cookie-only (the /admin/visits
//                                          page).
//   date               YYYY-MM-DD, default today (IST)
//   fromSource         case-insensitive exact match
//   guard              case-insensitive exact match
//   approvedByResident "true" / "false"
//   block, flatNumber  only honored when scope=all
//   page, limit        pagination (limit clamped 1..200)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") === "all" ? "all" : "mine";
    const adminView = scope === "all";

    // For mine scope, accept either Bearer JWT or session cookie. For admin
    // scope, require a cookie session with admin role (web-only).
    let block: number | null = null;
    let flatNumber: string | null = null;
    let isAdminUser = false;

    if (adminView) {
      const session = await auth();
      if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (!isAdmin(session.user.roles)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      isAdminUser = true;
    } else {
      const resident = await getAuthedResident(request);
      if (!resident) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (!resident.isApproved) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      block = resident.block;
      flatNumber = resident.flatNumber;
    }

    const dateFrom =
      searchParams.get("dateFrom") ||
      searchParams.get("date") ||
      istTodayYmd();
    const dateTo = searchParams.get("dateTo") || dateFrom;
    const fromSource = searchParams.get("fromSource") || undefined;
    const guard = searchParams.get("guard") || undefined;
    const approvedByResidentParam = searchParams.get("approvedByResident");
    const page = Math.max(
      1,
      parseInt(searchParams.get("page") || "1", 10) || 1
    );
    const limit = Math.min(
      200,
      Math.max(1, parseInt(searchParams.get("limit") || "50", 10) || 50)
    );

    const where: {
      visitDate?: string | { gte?: string; lte?: string };
      block?: number;
      flatNumber?: string;
      fromSource?: { equals: string; mode: "insensitive" };
      allowedByGuard?: { equals: string; mode: "insensitive" };
      approvedByResident?: boolean;
    } = {};
    where.visitDate =
      dateFrom === dateTo ? dateFrom : { gte: dateFrom, lte: dateTo };
    if (approvedByResidentParam === "true") where.approvedByResident = true;
    else if (approvedByResidentParam === "false")
      where.approvedByResident = false;

    if (adminView) {
      void isAdminUser;
      const blockParam = searchParams.get("block");
      const flatNumberParam = searchParams.get("flatNumber");
      if (blockParam) {
        const b = parseInt(blockParam, 10);
        if (!Number.isNaN(b)) where.block = b;
      }
      if (flatNumberParam) where.flatNumber = flatNumberParam;
    } else {
      // Owner view: always force caller's own flat.
      if (block != null) where.block = block;
      if (flatNumber != null) where.flatNumber = flatNumber;
    }

    if (fromSource)
      where.fromSource = { equals: fromSource, mode: "insensitive" };
    if (guard)
      where.allowedByGuard = { equals: guard, mode: "insensitive" };

    const [items, total] = await Promise.all([
      prisma.visitLog.findMany({
        where,
        orderBy: [{ inTime: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.visitLog.count({ where }),
    ]);

    return NextResponse.json({ items, total, page, limit, scope });
  } catch (err) {
    console.error("GET /api/visit-log failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch visit log" },
      { status: 500 }
    );
  }
}
