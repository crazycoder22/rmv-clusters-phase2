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

// PATCH /api/admin/fantasy/matches/[matchId]/players/[playerId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string; playerId: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { playerId } = await params;
  const { name, role } = await req.json();

  const validRoles = ["BATSMAN", "BOWLER", "ALLROUNDER", "WICKETKEEPER"];
  const data: Record<string, string> = {};
  if (name) data.name = name;
  if (role && validRoles.includes(role)) data.role = role;

  const player = await prisma.fantasyPlayer.update({ where: { id: playerId }, data });
  return NextResponse.json({ player });
}

// DELETE /api/admin/fantasy/matches/[matchId]/players/[playerId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ matchId: string; playerId: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { playerId } = await params;
  await prisma.fantasyPlayer.delete({ where: { id: playerId } });
  return NextResponse.json({ ok: true });
}
