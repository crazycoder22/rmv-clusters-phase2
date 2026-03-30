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

// PATCH /api/admin/fantasy/matches/[matchId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { matchId } = await params;
  const body = await req.json();

  const allowed = ["status", "title", "opponent", "venue", "matchDate"];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) {
      data[key] = key === "matchDate" ? new Date(body[key] as string) : body[key];
    }
  }

  const match = await prisma.fantasyMatch.update({ where: { id: matchId }, data });
  return NextResponse.json({ match });
}

// DELETE /api/admin/fantasy/matches/[matchId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { matchId } = await params;
  await prisma.fantasyMatch.delete({ where: { id: matchId } });
  return NextResponse.json({ ok: true });
}
