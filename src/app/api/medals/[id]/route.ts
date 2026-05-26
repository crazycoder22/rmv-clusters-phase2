import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageAnnouncements } from "@/lib/roles";
import { getAuthedResident } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// ── DELETE /api/medals/[id] ─────────────────────────────────────────────────
// Undo a mistakenly-awarded medal. Admin only. The Notification's
// medalAwardId is set to null via the SetNull cascade in the schema, so the
// user's notification stays in their bell as a record.
//
// Accepts NextAuth cookie (web) or `Authorization: Bearer <jwt>` (mobile).
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const me = await getAuthedResident(request);
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageAnnouncements(me.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const award = await prisma.medalAward.findUnique({ where: { id } });
  if (!award) {
    return NextResponse.json({ error: "Award not found" }, { status: 404 });
  }

  await prisma.medalAward.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
