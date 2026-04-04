import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageAnnouncements } from "@/lib/roles";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!canManageAnnouncements(session.user.roles)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { session };
}

// GET /api/admin/housekeeping/assignments?month=4&year=2026
export async function GET(req: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") ?? "");
  const year = parseInt(searchParams.get("year") ?? "");
  if (!month || !year) return NextResponse.json({ error: "month and year are required" }, { status: 400 });

  const assignments = await prisma.hKAssignment.findMany({
    where: { month, year },
    include: { staff: true },
    orderBy: [{ block: "asc" }, { staff: { name: "asc" } }],
  });
  return NextResponse.json({ assignments });
}

// POST /api/admin/housekeeping/assignments
// body: { staffId, block, month, year }
export async function POST(req: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { staffId, block, month, year } = await req.json();
  if (!staffId || !block || !month || !year) {
    return NextResponse.json({ error: "staffId, block, month, year are required" }, { status: 400 });
  }

  // Max 2 staff per block per month
  const existing = await prisma.hKAssignment.count({ where: { block, month, year } });
  if (existing >= 2) {
    return NextResponse.json({ error: "Block already has 2 staff assigned for this month." }, { status: 409 });
  }

  const assignment = await prisma.hKAssignment.create({
    data: { staffId, block, month, year },
    include: { staff: true },
  });
  return NextResponse.json({ assignment });
}
