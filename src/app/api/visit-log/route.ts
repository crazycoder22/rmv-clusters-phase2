import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/roles";
import { istTodayYmd } from "@/lib/dates-ist";

export const dynamic = "force-dynamic";

// GET /api/visit-log?date=&block=&flatNumber=&fromSource=&guard=&page=&limit=
// - Residents: forced to their own block+flatNumber (ignores any block/flatNumber params)
// - Admins: honors all filter params
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resident = await prisma.resident.findUnique({
      where: { email: session.user.email },
      select: { block: true, flatNumber: true, isApproved: true },
    });

    if (!resident?.isApproved) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const adminView = isAdmin(session.user.roles);

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || istTodayYmd();
    const fromSource = searchParams.get("fromSource") || undefined;
    const guard = searchParams.get("guard") || undefined;
    const approvedByResidentParam = searchParams.get("approvedByResident");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50", 10) || 50));

    // Build where clause — non-admins are forced to their own flat
    const where: {
      visitDate?: string;
      block?: number;
      flatNumber?: string;
      fromSource?: { equals: string; mode: "insensitive" };
      allowedByGuard?: { equals: string; mode: "insensitive" };
      approvedByResident?: boolean;
    } = {};
    if (date) where.visitDate = date;
    if (approvedByResidentParam === "true") where.approvedByResident = true;
    else if (approvedByResidentParam === "false") where.approvedByResident = false;

    if (adminView) {
      const blockParam = searchParams.get("block");
      const flatNumberParam = searchParams.get("flatNumber");
      if (blockParam) {
        const b = parseInt(blockParam, 10);
        if (!Number.isNaN(b)) where.block = b;
      }
      if (flatNumberParam) where.flatNumber = flatNumberParam;
    } else {
      // Non-admin: force to resident's own flat (ignore any block/flatNumber query params)
      where.block = resident.block;
      where.flatNumber = resident.flatNumber;
    }

    if (fromSource) where.fromSource = { equals: fromSource, mode: "insensitive" };
    if (guard) where.allowedByGuard = { equals: guard, mode: "insensitive" };

    const [items, total] = await Promise.all([
      prisma.visitLog.findMany({
        where,
        orderBy: [{ inTime: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.visitLog.count({ where }),
    ]);

    return NextResponse.json({ items, total, page, limit, adminView });
  } catch (err) {
    console.error("GET /api/visit-log failed:", err);
    return NextResponse.json({ error: "Failed to fetch visit log" }, { status: 500 });
  }
}
