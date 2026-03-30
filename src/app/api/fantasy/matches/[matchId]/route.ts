import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/fantasy/matches/[matchId] — match detail + players + scores
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params;

  const match = await prisma.fantasyMatch.findUnique({
    where: { id: matchId },
    include: {
      players: {
        include: { scoreEvent: true },
        orderBy: [{ role: "asc" }, { name: "asc" }],
      },
      _count: { select: { teams: true } },
    },
  });

  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  return NextResponse.json({ match });
}
