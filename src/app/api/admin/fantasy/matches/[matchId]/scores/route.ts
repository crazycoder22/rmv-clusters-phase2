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

// PUT /api/admin/fantasy/matches/[matchId]/scores
// Body: { scores: [{ playerId, runs, wickets, catches, runOuts, stumpings }] }
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { matchId } = await params;
  const { scores } = await req.json() as {
    scores: {
      playerId: string;
      runs?: number;
      wickets?: number;
      catches?: number;
      runOuts?: number;
      stumpings?: number;
    }[];
  };

  if (!scores || !Array.isArray(scores)) {
    return NextResponse.json({ error: "scores array required." }, { status: 400 });
  }

  // Verify players belong to this match
  const playerIds = scores.map((s) => s.playerId);
  const players = await prisma.fantasyPlayer.findMany({
    where: { id: { in: playerIds }, matchId },
    select: { id: true },
  });
  const validIds = new Set(players.map((p) => p.id));

  const results = await Promise.all(
    scores
      .filter((s) => validIds.has(s.playerId))
      .map((s) =>
        prisma.fantasyScoreEvent.upsert({
          where: { playerId: s.playerId },
          create: {
            playerId: s.playerId,
            runs: s.runs ?? 0,
            wickets: s.wickets ?? 0,
            catches: s.catches ?? 0,
            runOuts: s.runOuts ?? 0,
            stumpings: s.stumpings ?? 0,
          },
          update: {
            runs: s.runs ?? 0,
            wickets: s.wickets ?? 0,
            catches: s.catches ?? 0,
            runOuts: s.runOuts ?? 0,
            stumpings: s.stumpings ?? 0,
          },
        })
      )
  );

  return NextResponse.json({ updated: results.length });
}
