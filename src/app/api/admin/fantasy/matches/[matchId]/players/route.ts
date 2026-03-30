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

// GET /api/admin/fantasy/matches/[matchId]/players
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { matchId } = await params;
  const players = await prisma.fantasyPlayer.findMany({
    where: { matchId },
    include: { scoreEvent: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ players });
}

// POST /api/admin/fantasy/matches/[matchId]/players
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { matchId } = await params;
  const { name, role } = await req.json();

  const validRoles = ["BATSMAN", "BOWLER", "ALLROUNDER", "WICKETKEEPER"];
  if (!name || !role || !validRoles.includes(role)) {
    return NextResponse.json({ error: "name and valid role are required." }, { status: 400 });
  }

  const player = await prisma.fantasyPlayer.create({
    data: { matchId, name, role },
  });
  return NextResponse.json({ player });
}
