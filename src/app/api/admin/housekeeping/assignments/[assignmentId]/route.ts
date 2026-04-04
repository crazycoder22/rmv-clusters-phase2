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

// DELETE /api/admin/housekeeping/assignments/[assignmentId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { assignmentId } = await params;
  await prisma.hKAssignment.delete({ where: { id: assignmentId } });
  return NextResponse.json({ ok: true });
}
