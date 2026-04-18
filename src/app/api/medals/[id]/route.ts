import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageAnnouncements } from "@/lib/roles";

export const dynamic = "force-dynamic";

// ── DELETE /api/medals/[id] ─────────────────────────────────────────────────
// Undo a mistakenly-awarded medal. Admin only. The Notification's
// medalAwardId is set to null via the SetNull cascade in the schema, so the
// user's notification stays in their bell as a record.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageAnnouncements(session.user.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const award = await prisma.medalAward.findUnique({ where: { id } });
  if (!award) {
    return NextResponse.json({ error: "Award not found" }, { status: 404 });
  }

  await prisma.medalAward.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
