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

// PATCH /api/admin/housekeeping/staff/[staffId] — update name or active status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ staffId: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { staffId } = await params;
  const { name, active } = await req.json();
  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name.trim();
  if (active !== undefined) data.active = active;

  const staff = await prisma.hKStaff.update({ where: { id: staffId }, data });
  return NextResponse.json({ staff });
}

// DELETE /api/admin/housekeeping/staff/[staffId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ staffId: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { staffId } = await params;
  await prisma.hKStaff.delete({ where: { id: staffId } });
  return NextResponse.json({ ok: true });
}
