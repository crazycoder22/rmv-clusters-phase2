import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageAnnouncements } from "@/lib/roles";
import { HKStaffType } from "../../../../../generated/prisma/client";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!canManageAnnouncements(session.user.roles)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { session };
}

// GET /api/admin/housekeeping/staff
export async function GET() {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const staff = await prisma.hKStaff.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return NextResponse.json({ staff });
}

// POST /api/admin/housekeeping/staff
export async function POST(req: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { name, type } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });

  const validTypes = Object.values(HKStaffType);
  const staffType: HKStaffType = validTypes.includes(type) ? type : HKStaffType.HOUSEKEEPING;

  const staff = await prisma.hKStaff.create({ data: { name: name.trim(), type: staffType } });
  return NextResponse.json({ staff });
}
