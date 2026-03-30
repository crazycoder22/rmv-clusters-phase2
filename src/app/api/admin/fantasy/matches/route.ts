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

// GET /api/admin/fantasy/matches
export async function GET() {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const matches = await prisma.fantasyMatch.findMany({
    orderBy: { matchDate: "desc" },
    include: { _count: { select: { players: true, teams: true } } },
  });
  return NextResponse.json({ matches });
}

// POST /api/admin/fantasy/matches
export async function POST(req: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { title, opponent, venue, matchDate } = await req.json();
  if (!title || !opponent || !matchDate) {
    return NextResponse.json({ error: "title, opponent and matchDate are required." }, { status: 400 });
  }

  const match = await prisma.fantasyMatch.create({
    data: { title, opponent, venue: venue || null, matchDate: new Date(matchDate), status: "OPEN" },
  });
  return NextResponse.json({ match });
}
